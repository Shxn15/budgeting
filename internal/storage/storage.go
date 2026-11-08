// Package storage persists the application's data document on disk.
//
// Design goals (user data must survive every future version of the app):
//   - The data lives in the user's config directory (%APPDATA% on Windows),
//     never next to the .exe, so replacing the .exe never touches it.
//   - Every write is atomic (temp file + rename), so a crash or power loss
//     can never leave a half-written file behind.
//   - Automatic daily backups plus labelled backups (e.g. before a schema
//     migration) make it possible to recover from any mistake.
//   - A file that cannot be read is moved aside ("quarantined"), never
//     deleted or overwritten.
//
// The storage layer deliberately treats the document as opaque JSON. The
// schema (and its migrations) is owned by the frontend; see
// frontend/src/persistence.
package storage

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	// DataFileName is the name of the main data document.
	DataFileName = "data.json"
	// BackupDirName is the sub directory that holds all backups.
	BackupDirName = "backups"

	// DataDirEnv overrides the data directory (useful for development,
	// tests or a portable setup).
	DataDirEnv = "BUDGETING_DATA_DIR"

	// MaxAutoBackups is how many automatic (daily) backups are kept.
	MaxAutoBackups = 30

	autoBackupLabel = "auto"
	backupPrefix    = "data-"
	timeLayout      = "2006-01-02_150405"
)

// ErrInvalidContent is returned when Save receives something that is not a
// JSON object.
var ErrInvalidContent = errors.New("storage: content is not a valid JSON object")

// BackupInfo describes a backup file.
type BackupInfo struct {
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"createdAt"`
	Size      int64     `json:"size"`
}

// Store reads and writes the data document inside a directory.
type Store struct {
	dir string
	mu  sync.Mutex
	now func() time.Time
}

// DefaultDir returns the directory used for user data:
// %APPDATA%\<appDirName> on Windows, ~/.config/<appDirName> on Linux and
// ~/Library/Application Support/<appDirName> on macOS.
// The environment variable BUDGETING_DATA_DIR overrides it.
func DefaultDir(appDirName string) (string, error) {
	if dir := strings.TrimSpace(os.Getenv(DataDirEnv)); dir != "" {
		return filepath.Abs(dir)
	}
	base, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("storage: cannot determine user config dir: %w", err)
	}
	return filepath.Join(base, appDirName), nil
}

// New creates a Store for dir and makes sure the directory exists.
func New(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("storage: cannot create data dir: %w", err)
	}
	return &Store{dir: dir, now: time.Now}, nil
}

// Dir is the data directory.
func (s *Store) Dir() string { return s.dir }

// DataPath is the full path of the data document.
func (s *Store) DataPath() string { return filepath.Join(s.dir, DataFileName) }

// BackupDir is the directory that holds backups.
func (s *Store) BackupDir() string { return filepath.Join(s.dir, BackupDirName) }

// Load returns the raw data document. found is false when no data has been
// saved yet (first start).
func (s *Store) Load() (content string, found bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	b, err := os.ReadFile(s.DataPath())
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("storage: cannot read data file: %w", err)
	}
	return string(b), true, nil
}

// Save atomically replaces the data document with content, which must be a
// JSON object.
func (s *Store) Save(content string) error {
	if !isJSONObject(content) {
		return ErrInvalidContent
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeFileAtomic(s.DataPath(), []byte(content))
}

// Backup copies the current data document into the backup directory. label
// becomes part of the file name (e.g. "manual", "pre-migration-v1"). It
// returns the backup path, or "" when there is no data document yet.
func (s *Store) Backup(label string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.backupLocked(sanitizeLabel(label))
}

// EnsureDailyBackup creates an automatic backup if none was made today and
// prunes automatic backups beyond MaxAutoBackups. Labelled backups (manual,
// pre-migration, ...) are never pruned. Returns the new backup path or "".
func (s *Store) EnsureDailyBackup() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	backups, err := s.listLocked()
	if err != nil {
		return "", err
	}
	today := s.now().Format("2006-01-02")
	for _, b := range backups {
		if b.Label == autoBackupLabel && b.CreatedAt.Format("2006-01-02") == today {
			return "", nil
		}
	}

	path, err := s.backupLocked(autoBackupLabel)
	if err != nil || path == "" {
		return path, err
	}
	return path, s.pruneLocked()
}

// Quarantine moves an unreadable data document aside (data.corrupt-<time>.json)
// so the app can start over without destroying it. Returns the new path.
func (s *Store) Quarantine() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.DataPath()); errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	target := filepath.Join(s.dir, "data.corrupt-"+s.now().Format(timeLayout)+".json")
	if err := renameWithRetry(s.DataPath(), target); err != nil {
		return "", fmt.Errorf("storage: cannot quarantine data file: %w", err)
	}
	return target, nil
}

// ListBackups returns all backups, newest first.
func (s *Store) ListBackups() ([]BackupInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.listLocked()
}

func (s *Store) backupLocked(label string) (string, error) {
	src, err := os.Open(s.DataPath())
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("storage: cannot open data file for backup: %w", err)
	}
	defer src.Close()

	if err := os.MkdirAll(s.BackupDir(), 0o755); err != nil {
		return "", fmt.Errorf("storage: cannot create backup dir: %w", err)
	}

	base := backupPrefix + s.now().Format(timeLayout) + "-" + label
	target := filepath.Join(s.BackupDir(), base+".json")
	for i := 2; fileExists(target); i++ {
		target = filepath.Join(s.BackupDir(), fmt.Sprintf("%s-%d.json", base, i))
	}

	content, err := io.ReadAll(src)
	if err != nil {
		return "", fmt.Errorf("storage: cannot read data file for backup: %w", err)
	}
	if err := writeFileAtomic(target, content); err != nil {
		return "", err
	}
	return target, nil
}

func (s *Store) listLocked() ([]BackupInfo, error) {
	entries, err := os.ReadDir(s.BackupDir())
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("storage: cannot list backups: %w", err)
	}

	var out []BackupInfo
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, ok := parseBackupName(e.Name())
		if !ok {
			continue
		}
		info.Path = filepath.Join(s.BackupDir(), e.Name())
		if fi, err := e.Info(); err == nil {
			info.Size = fi.Size()
		}
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].Name > out[j].Name
		}
		return out[i].CreatedAt.After(out[j].CreatedAt)
	})
	return out, nil
}

func (s *Store) pruneLocked() error {
	backups, err := s.listLocked()
	if err != nil {
		return err
	}
	kept := 0
	for _, b := range backups {
		if b.Label != autoBackupLabel {
			continue
		}
		kept++
		if kept > MaxAutoBackups {
			if err := os.Remove(b.Path); err != nil && !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("storage: cannot prune backup: %w", err)
			}
		}
	}
	return nil
}

// parseBackupName parses "data-2006-01-02_150405-<label>[-n].json".
func parseBackupName(name string) (BackupInfo, bool) {
	if !strings.HasPrefix(name, backupPrefix) || !strings.HasSuffix(name, ".json") {
		return BackupInfo{}, false
	}
	rest := strings.TrimSuffix(strings.TrimPrefix(name, backupPrefix), ".json")
	if len(rest) < len(timeLayout)+2 || rest[len(timeLayout)] != '-' {
		return BackupInfo{}, false
	}
	t, err := time.ParseInLocation(timeLayout, rest[:len(timeLayout)], time.Local)
	if err != nil {
		return BackupInfo{}, false
	}
	return BackupInfo{Name: name, Label: rest[len(timeLayout)+1:], CreatedAt: t}, true
}

func sanitizeLabel(label string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(label)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_' || r == ' ' || r == '.':
			b.WriteRune('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	if out == "" || out == autoBackupLabel {
		// "auto" is reserved for daily backups, which get pruned.
		return "manual"
	}
	if len(out) > 40 {
		out = out[:40]
	}
	return out
}

func isJSONObject(content string) bool {
	trimmed := strings.TrimSpace(content)
	return strings.HasPrefix(trimmed, "{") && json.Valid([]byte(trimmed))
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// writeFileAtomic writes data to a temp file in the target directory, flushes
// it to disk and renames it over path. Readers either see the old or the new
// file, never a partial one.
func writeFileAtomic(path string, data []byte) (err error) {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".tmp-"+filepath.Base(path)+"-*")
	if err != nil {
		return fmt.Errorf("storage: cannot create temp file: %w", err)
	}
	tmpName := tmp.Name()
	defer func() {
		if err != nil {
			_ = os.Remove(tmpName)
		}
	}()

	if _, err = tmp.Write(data); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("storage: cannot write temp file: %w", err)
	}
	if err = tmp.Sync(); err != nil {
		_ = tmp.Close()
		return fmt.Errorf("storage: cannot flush temp file: %w", err)
	}
	if err = tmp.Close(); err != nil {
		return fmt.Errorf("storage: cannot close temp file: %w", err)
	}
	if err = renameWithRetry(tmpName, path); err != nil {
		return fmt.Errorf("storage: cannot replace %s: %w", filepath.Base(path), err)
	}
	return nil
}

// renameWithRetry retries a rename a few times on Windows, where virus
// scanners or indexers can briefly lock a freshly written file.
func renameWithRetry(from, to string) error {
	attempts := 1
	if runtime.GOOS == "windows" {
		attempts = 6
	}
	var err error
	for i := 0; i < attempts; i++ {
		if err = os.Rename(from, to); err == nil {
			return nil
		}
		if i < attempts-1 {
			time.Sleep(time.Duration(i+1) * 40 * time.Millisecond)
		}
	}
	return err
}
