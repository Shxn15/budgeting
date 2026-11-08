package main

import (
	"context"
	"errors"
	"log"
	goruntime "runtime"

	"budgeting/internal/storage"
	"budgeting/internal/system"

	"github.com/wailsapp/wails/v2/pkg/options"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// AppInfo is static information about the running app shown in the UI.
type AppInfo struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	DataDir   string `json:"dataDir"`
	DataFile  string `json:"dataFile"`
	BackupDir string `json:"backupDir"`
	Platform  string `json:"platform"`
}

// LoadResult is returned by LoadData.
type LoadResult struct {
	// Found is false on the very first start (no data saved yet).
	Found bool `json:"found"`
	// Content is the raw JSON document. The frontend validates and migrates it.
	Content string `json:"content"`
}

// App is bound to the frontend: every exported method is callable from
// JavaScript as window.go.main.App.<Method>() and returns a Promise.
// Keep this layer thin; storage logic lives in internal/storage.
type App struct {
	ctx     context.Context
	version string
	store   *storage.Store
	initErr error
}

// NewApp creates the app backend and opens the data directory.
func NewApp(version string) *App {
	a := &App{version: version}
	dir, err := storage.DefaultDir(dataDirName)
	if err == nil {
		a.store, err = storage.New(dir)
	}
	a.initErr = err
	return a
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.store == nil {
		return
	}
	// One automatic backup per day, before the frontend can change anything.
	if _, err := a.store.EnsureDailyBackup(); err != nil {
		log.Printf("daily backup failed: %v", err)
	}
}

func (a *App) domReady(ctx context.Context) {
	// On small screens (e.g. 1366x768 laptops with scaling) the default window
	// would not fit, so start maximised there.
	screens, err := wailsruntime.ScreenGetAll(ctx)
	if err != nil {
		return
	}
	for _, s := range screens {
		if s.IsCurrent && (s.Size.Width < defaultWidth+40 || s.Size.Height < defaultHeight+60) {
			wailsruntime.WindowMaximise(ctx)
			return
		}
	}
}

func (a *App) onSecondInstanceLaunch(_ options.SecondInstanceData) {
	if a.ctx == nil {
		return
	}
	// Bring the already running window to the front instead of opening a
	// second instance that would write to the same data file.
	wailsruntime.WindowUnminimise(a.ctx)
	wailsruntime.WindowShow(a.ctx)
}

func (a *App) storeOrErr() (*storage.Store, error) {
	if a.store == nil {
		if a.initErr != nil {
			return nil, a.initErr
		}
		return nil, errors.New("Datenspeicher nicht verfügbar")
	}
	return a.store, nil
}

// GetAppInfo returns version and data locations.
func (a *App) GetAppInfo() AppInfo {
	info := AppInfo{Name: appName, Version: a.version, Platform: goruntime.GOOS}
	if a.store != nil {
		info.DataDir = a.store.Dir()
		info.DataFile = a.store.DataPath()
		info.BackupDir = a.store.BackupDir()
	}
	return info
}

// LoadData returns the stored data document.
func (a *App) LoadData() (LoadResult, error) {
	s, err := a.storeOrErr()
	if err != nil {
		return LoadResult{}, err
	}
	content, found, err := s.Load()
	return LoadResult{Found: found, Content: content}, err
}

// SaveData atomically replaces the stored data document.
func (a *App) SaveData(content string) error {
	s, err := a.storeOrErr()
	if err != nil {
		return err
	}
	return s.Save(content)
}

// CreateBackup copies the current data document into the backup folder and
// returns the backup path ("" if there is nothing to back up yet).
func (a *App) CreateBackup(label string) (string, error) {
	s, err := a.storeOrErr()
	if err != nil {
		return "", err
	}
	return s.Backup(label)
}

// ListBackups returns all backups, newest first.
func (a *App) ListBackups() ([]storage.BackupInfo, error) {
	s, err := a.storeOrErr()
	if err != nil {
		return nil, err
	}
	return s.ListBackups()
}

// QuarantineData moves an unreadable data file aside so the app can start
// with empty data without destroying the old file. Returns the new path.
func (a *App) QuarantineData() (string, error) {
	s, err := a.storeOrErr()
	if err != nil {
		return "", err
	}
	return s.Quarantine()
}

// OpenDataFolder shows the data folder in the file manager.
func (a *App) OpenDataFolder() error {
	s, err := a.storeOrErr()
	if err != nil {
		return err
	}
	return system.OpenFolder(s.Dir())
}
