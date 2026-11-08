package main

import (
	"embed"
	"encoding/json"
	"os"
	"path/filepath"

	"budgeting/internal/system"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// wails.json is the single source of truth for the app version
// (info.productVersion). It is also written into the .exe file properties.
//
//go:embed wails.json
var wailsConfig []byte

const (
	appName = "Budgeting"

	// dataDirName is the folder inside the user's config directory
	// (%APPDATA% on Windows) that holds data.json and all backups.
	//
	// NEVER change this value without adding code that moves the old folder,
	// otherwise every user would start with empty data after an update.
	dataDirName = "Budgeting"

	// singleInstanceID makes sure only one instance writes to the data file.
	singleInstanceID = "budgeting-932664a4-d0de-4730-91cc-5601c53184fa"

	defaultWidth  = 1240
	defaultHeight = 800
)

// Window background colours; they must match --bg in frontend/src/styles/tokens.css
// so there is no flash of the wrong colour while the UI loads.
var (
	backgroundLight = &options.RGBA{R: 243, G: 244, B: 248, A: 255}
	backgroundDark  = &options.RGBA{R: 13, G: 16, B: 22, A: 255}
)

func main() {
	app := NewApp(appVersion())
	theme := initialTheme(app)

	background := backgroundLight
	if theme == windows.Dark || (theme == windows.SystemDefault && system.PrefersDarkMode()) {
		background = backgroundDark
	}

	err := wails.Run(&options.App{
		Title:            appName,
		Width:            defaultWidth,
		Height:           defaultHeight,
		MinWidth:         940,
		MinHeight:        620,
		BackgroundColour: background,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnDomReady: app.domReady,
		Bind: []interface{}{
			app,
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               singleInstanceID,
			OnSecondInstanceLaunch: app.onSecondInstanceLaunch,
		},
		// Dropping a file onto the window must not navigate away from the app.
		DragAndDrop: &options.DragAndDrop{
			DisableWebViewDrop: true,
		},
		Windows: &windows.Options{
			Theme:               theme,
			WebviewUserDataPath: webviewDataPath(),
			Messages:            germanWebViewMessages(),
		},
	})
	if err != nil {
		println("Error:", err.Error())
		os.Exit(1)
	}
}

func appVersion() string {
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if err := json.Unmarshal(wailsConfig, &cfg); err != nil || cfg.Info.ProductVersion == "" {
		return "dev"
	}
	return cfg.Info.ProductVersion
}

// initialTheme reads the theme the user chose in the app (stored in
// data.json) so the title bar and window background match from the very
// first frame.
func initialTheme(app *App) windows.Theme {
	if app.store == nil {
		return windows.SystemDefault
	}
	content, found, err := app.store.Load()
	if err != nil || !found {
		return windows.SystemDefault
	}
	var doc struct {
		Settings struct {
			Theme string `json:"theme"`
		} `json:"settings"`
	}
	if json.Unmarshal([]byte(content), &doc) != nil {
		return windows.SystemDefault
	}
	switch doc.Settings.Theme {
	case "dark":
		return windows.Dark
	case "light":
		return windows.Light
	default:
		return windows.SystemDefault
	}
}

// webviewDataPath keeps the WebView2 cache in a fixed place
// (%LOCALAPPDATA%\Budgeting\WebView2), independent of the .exe file name.
func webviewDataPath() string {
	base, err := os.UserCacheDir()
	if err != nil {
		return ""
	}
	return filepath.Join(base, dataDirName, "WebView2")
}

func germanWebViewMessages() *windows.Messages {
	return &windows.Messages{
		InstallationRequired: "Für Budgeting wird die Microsoft WebView2-Laufzeit benötigt. Mit OK wird sie heruntergeladen und installiert. Hinweis: Die Installation läuft im Hintergrund, bitte kurz warten.",
		UpdateRequired:       "Die Microsoft WebView2-Laufzeit muss aktualisiert werden. Mit OK wird das Update heruntergeladen und installiert. Hinweis: Die Installation läuft im Hintergrund, bitte kurz warten.",
		MissingRequirements:  "Fehlende Voraussetzungen",
		Webview2NotInstalled: "WebView2-Laufzeit nicht installiert",
		Error:                "Fehler",
		FailedToInstall:      "Die WebView2-Laufzeit konnte nicht installiert werden. Bitte versuche es erneut.",
		DownloadPage:         "Budgeting benötigt die Microsoft WebView2-Laufzeit. Mit OK öffnet sich die Download-Seite. Mindestens benötigte Version: ",
		PressOKToInstall:     "Zum Installieren OK drücken.",
		ContactAdmin:         "Für Budgeting wird die Microsoft WebView2-Laufzeit benötigt. Bitte wende dich an deinen Administrator.",
		InvalidFixedWebview2: "Die angegebene WebView2-Laufzeit ist ungültig. Bitte Mindestversion und Pfad prüfen.",
		WebView2ProcessCrash: "Der WebView2-Prozess ist abgestürzt. Bitte starte Budgeting neu.",
	}
}
