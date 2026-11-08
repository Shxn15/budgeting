#!/usr/bin/env bash
# Builds Budgeting.exe for Windows (64 bit). Works on Windows (Git Bash),
# Linux and macOS – no C compiler needed. Output: build/bin/Budgeting-<version>-windows-x64.exe
set -euo pipefail
cd "$(dirname "$0")/.."

WAILS_VERSION=v2.17.1
export PATH="$PATH:$(go env GOPATH)/bin"

if ! command -v wails >/dev/null 2>&1; then
  echo "Installing Wails CLI $WAILS_VERSION ..."
  go install "github.com/wailsapp/wails/v2/cmd/wails@$WAILS_VERSION"
fi

version=$(node -p "require('./wails.json').info.productVersion")

(cd frontend && npm ci && npm run typecheck && npm test)
go test ./internal/...

CGO_ENABLED=0 wails build -platform windows/amd64 -clean -trimpath -skipbindings
mv build/bin/Budgeting.exe "build/bin/Budgeting-$version-windows-x64.exe"
echo
echo "Fertig: build/bin/Budgeting-$version-windows-x64.exe"
