//go:build windows

package system

import (
	"os/exec"

	"golang.org/x/sys/windows/registry"
)

func openFolder(dir string) error {
	// explorer.exe returns a non-zero exit code even on success, so only Start it.
	return exec.Command("explorer.exe", dir).Start()
}

func prefersDarkMode() bool {
	key, err := registry.OpenKey(registry.CURRENT_USER,
		`Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer key.Close()
	value, _, err := key.GetIntegerValue("AppsUseLightTheme")
	if err != nil {
		return false
	}
	return value == 0
}
