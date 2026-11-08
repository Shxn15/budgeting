// Package system wraps the few operating-system specific bits the app needs.
package system

import (
	"fmt"
	"os"
)

// OpenFolder opens dir in the platform's file manager (Explorer on Windows).
func OpenFolder(dir string) error {
	if _, err := os.Stat(dir); err != nil {
		return fmt.Errorf("system: folder not found: %w", err)
	}
	return openFolder(dir)
}

// PrefersDarkMode reports whether the operating system uses a dark app theme.
func PrefersDarkMode() bool {
	return prefersDarkMode()
}
