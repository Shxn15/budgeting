//go:build !windows

package system

import (
	"os/exec"
	"runtime"
)

func openFolder(dir string) error {
	name := "xdg-open"
	if runtime.GOOS == "darwin" {
		name = "open"
	}
	return exec.Command(name, dir).Start()
}

func prefersDarkMode() bool {
	return false
}
