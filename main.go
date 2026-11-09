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

// windowBackground holds the light and dark window background colour of a
// colour theme (settings.colorTheme). They must match --bg in
// frontend/src/styles/tokens.css so there is no flash of the wrong colour
// while the UI loads.
type windowBackground struct{ light, dark options.RGBA }

var backgrounds = map[string]windowBackground{
	"standard": {light: options.RGBA{R: 243, G: 244, B: 248, A: 255}, dark: options.RGBA{R: 13, G: 16, B: 22, A: 255}},
	"rose":     {light: options.RGBA{R: 252, G: 240, B: 244, A: 255}, dark: options.RGBA{R: 23, G: 14, B: 19, A: 255}},
	"lavender": {light: options.RGBA{R: 244, G: 241, B: 252, A: 255}, dark: options.RGBA{R: 17, G: 14, B: 27, A: 255}},
	"mint":     {light: options.RGBA{R: 237, G: 247, B: 242, A: 255}, dark: options.RGBA{R: 11, G: 21, B: 18, A: 255}},
	"peach":    {light: options.RGBA{R: 253, G: 243, B: 236, A: 255}, dark: options.RGBA{R: 23, G: 16, B: 11, A: 255}},
	"sky":      {light: options.RGBA{R: 237, G: 245, B: 252, A: 255}, dark: options.RGBA{R: 10, G: 18, B: 27, A: 255}},
}

func main() {
	app := NewApp(appVersion())
	theme, palette := initialAppearance(app)

	colours, ok := backgrounds[palette]
	if !ok {
		colours = backgrounds["standard"]
	}
	background := colours.light
	if theme == windows.Dark || (theme == windows.SystemDefault && system.PrefersDarkMode()) {
		background = colours.dark
	}

	err := wails.Run(&options.App{
		Title:            appName,
		Width:            defaultWidth,
		Height:           defaultHeight,
		MinWidth:         940,
		MinHeight:        620,
		BackgroundColour: &background,
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

// initialAppearance reads the light/dark theme and the colour theme the user
// chose in the app (stored in data.json) so the title bar and window
// background match from the very first frame.
func initialAppearance(app *App) (windows.Theme, string) {
	if app.store == nil {
		return windows.SystemDefault, ""
	}
	content, found, err := app.store.Load()
	if err != nil || !found {
		return windows.SystemDefault, ""
	}
	var doc struct {
		Settings struct {
			Theme      string `json:"theme"`
			ColorTheme string `json:"colorTheme"`
		} `json:"settings"`
	}
	if json.Unmarshal([]byte(content), &doc) != nil {
		return windows.SystemDefault, ""
	}
	switch doc.Settings.Theme {
	case "dark":
		return windows.Dark, doc.Settings.ColorTheme
	case "light":
		return windows.Light, doc.Settings.ColorTheme
	default:
		return windows.SystemDefault, doc.Settings.ColorTheme
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
