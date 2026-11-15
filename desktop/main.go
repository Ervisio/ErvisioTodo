package main

import (
	"embed"
	"encoding/json"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

// wails.json is the single source of the version (synced from package.json).
//
//go:embed wails.json
var wailsJSON []byte

func appVersion() string {
	var v struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	_ = json.Unmarshal(wailsJSON, &v)
	return v.Info.ProductVersion
}

func main() {
	base, err := os.UserConfigDir()
	if err != nil {
		log.Fatal(err)
	}
	dir := filepath.Join(base, "ErvisioTodo")
	cfgPath := filepath.Join(dir, "config.json")
	cfg := loadConfig(cfgPath)
	cfg.Window = clampWindow(cfg.Window, virtualScreen())

	app := &App{cfgPath: cfgPath, cfg: cfg, version: appVersion(), token: newToken()}
	start := options.Normal
	if cfg.Window.Maximised {
		start = options.Maximised
	}

	err = wails.Run(&options.App{
		Title:            "ErvisioTodo",
		Width:            cfg.Window.Width,
		Height:           cfg.Window.Height,
		MinWidth:         minWidth,
		MinHeight:        minHeight,
		WindowStartState: start,
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 255}, // the app's dark canvas
		AssetServer:      &assetserver.Options{Assets: assets, Handler: app.bridgeHandler()},
		Menu:             app.buildMenu(),
		OnStartup:        app.onStartup,
		OnDomReady:       app.onDomReady,
		OnBeforeClose:    app.onBeforeClose,
		Bind:             []any{&Local{app}},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "com.ervisio.todo",
			OnSecondInstanceLaunch: func(options.SecondInstanceData) { app.onSecondLaunch() },
		},
		Windows: &windows.Options{WebviewUserDataPath: filepath.Join(dir, "webview")},
	})
	if err != nil {
		log.Fatal(err)
	}
}
