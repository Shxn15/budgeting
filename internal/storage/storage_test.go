package storage

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := New(filepath.Join(t.TempDir(), "Budgeting"))
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return s
}

func TestLoadWithoutDataFile(t *testing.T) {
	s := newTestStore(t)
	content, found, err := s.Load()
	if err != nil || found || content != "" {
		t.Fatalf("Load() = %q, %v, %v; want empty, false, nil", content, found, err)
	}
}

func TestSaveAndLoadRoundTrip(t *testing.T) {
	s := newTestStore(t)
	doc := `{"schemaVersion":1,"accounts":[{"name":"Bargeld"}]}`
	if err := s.Save(doc); err != nil {
		t.Fatalf("Save: %v", err)
	}
	content, found, err := s.Load()
	if err != nil || !found || content != doc {
		t.Fatalf("Load() = %q, %v, %v", content, found, err)
	}

	// Overwrite works and leaves no temp files behind.
	doc2 := `{"schemaVersion":1,"accounts":[]}`
	if err := s.Save(doc2); err != nil {
		t.Fatalf("Save #2: %v", err)
	}
	content, _, _ = s.Load()
	if content != doc2 {
		t.Fatalf("after overwrite got %q", content)
	}
	entries, _ := os.ReadDir(s.Dir())
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".tmp-") {
			t.Fatalf("temp file left behind: %s", e.Name())
		}
	}
}

func TestSaveRejectsInvalidContent(t *testing.T) {
	s := newTestStore(t)
	if err := s.Save(`{"ok":true}`); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"", "   ", "null", "[1,2]", `{"broken":`, "hello"} {
		if err := s.Save(bad); err != ErrInvalidContent {
			t.Errorf("Save(%q) = %v; want ErrInvalidContent", bad, err)
		}
	}
	// The previous document must be untouched.
	content, _, _ := s.Load()
	if content != `{"ok":true}` {
		t.Fatalf("data was modified by invalid save: %q", content)
	}
}

func TestBackupAndList(t *testing.T) {
	s := newTestStore(t)

	path, err := s.Backup("manual")
	if err != nil || path != "" {
		t.Fatalf("Backup without data = %q, %v; want empty path", path, err)
	}

	if err := s.Save(`{"v":1}`); err != nil {
		t.Fatal(err)
	}
	path, err = s.Backup("Pre Migration v1")
	if err != nil {
		t.Fatalf("Backup: %v", err)
	}
	if !strings.HasSuffix(path, "-pre-migration-v1.json") {
		t.Fatalf("unexpected backup name %q", path)
	}
	b, _ := os.ReadFile(path)
	if string(b) != `{"v":1}` {
		t.Fatalf("backup content = %q", b)
	}

	// Same label within the same second gets a unique name.
	path2, err := s.Backup("pre-migration-v1")
	if err != nil || path2 == path {
		t.Fatalf("second backup = %q, %v", path2, err)
	}

	list, err := s.ListBackups()
	if err != nil || len(list) != 2 {
		t.Fatalf("ListBackups = %v, %v", list, err)
	}
}

func TestReservedLabelBecomesManual(t *testing.T) {
	s := newTestStore(t)
	_ = s.Save(`{}`)
	path, err := s.Backup("auto")
	if err != nil || !strings.HasSuffix(path, "-manual.json") {
		t.Fatalf("Backup(auto) = %q, %v; want a manual backup", path, err)
	}
}

func TestEnsureDailyBackupOncePerDayAndPrune(t *testing.T) {
	s := newTestStore(t)
	if err := s.Save(`{"v":1}`); err != nil {
		t.Fatal(err)
	}

	day := time.Date(2026, 1, 1, 9, 0, 0, 0, time.Local)
	s.now = func() time.Time { return day }

	first, err := s.EnsureDailyBackup()
	if err != nil || first == "" {
		t.Fatalf("first daily backup = %q, %v", first, err)
	}
	day = day.Add(3 * time.Hour)
	again, err := s.EnsureDailyBackup()
	if err != nil || again != "" {
		t.Fatalf("second backup on the same day = %q, %v; want none", again, err)
	}

	// A labelled backup must never be pruned.
	if _, err := s.Backup("pre-migration-v1"); err != nil {
		t.Fatal(err)
	}

	for i := 1; i <= MaxAutoBackups+5; i++ {
		day = day.AddDate(0, 0, 1)
		if _, err := s.EnsureDailyBackup(); err != nil {
			t.Fatal(err)
		}
	}

	list, _ := s.ListBackups()
	auto, labelled := 0, 0
	for _, b := range list {
		if b.Label == "auto" {
			auto++
		} else {
			labelled++
		}
	}
	if auto != MaxAutoBackups || labelled != 1 {
		t.Fatalf("auto=%d labelled=%d; want %d and 1", auto, labelled, MaxAutoBackups)
	}
	// Newest first.
	if !list[0].CreatedAt.After(list[len(list)-1].CreatedAt) {
		t.Fatalf("backups not sorted newest first")
	}
}

func TestQuarantine(t *testing.T) {
	s := newTestStore(t)
	if path, err := s.Quarantine(); err != nil || path != "" {
		t.Fatalf("Quarantine without file = %q, %v", path, err)
	}

	if err := os.WriteFile(s.DataPath(), []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	path, err := s.Quarantine()
	if err != nil || path == "" {
		t.Fatalf("Quarantine = %q, %v", path, err)
	}
	if _, found, _ := s.Load(); found {
		t.Fatal("data file still present after quarantine")
	}
	b, _ := os.ReadFile(path)
	if string(b) != "{not json" {
		t.Fatalf("quarantined content changed: %q", b)
	}
}

func TestDefaultDirEnvOverride(t *testing.T) {
	dir := t.TempDir()
	t.Setenv(DataDirEnv, dir)
	got, err := DefaultDir("Budgeting")
	if err != nil || got != dir {
		t.Fatalf("DefaultDir = %q, %v; want %q", got, err, dir)
	}

	t.Setenv(DataDirEnv, "")
	got, err = DefaultDir("Budgeting")
	if err != nil || filepath.Base(got) != "Budgeting" {
		t.Fatalf("DefaultDir = %q, %v", got, err)
	}
}
