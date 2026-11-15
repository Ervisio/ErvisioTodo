package main

import (
	"context"
	"encoding/json"
	"strconv"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	minZoom  = 0.5
	maxZoom  = 3.0
	zoomStep = 0.1
)

// App holds the window state. Only Local (below) is bound to the webview.
type App struct {
	ctx         context.Context
	cfgPath     string
	version     string
	token       string // secret in the bridge URLs, see bridge.go
	mu          sync.Mutex
	cfg         Config
	local       bool   // webview currently shows the embedded local page
	forceSetup  bool   // show the address form even if an address is saved
	mode        string // setup | error | connected
	localOrigin string
}

// Local is the only object exposed to JavaScript. Wails delivers its calls
// only from the embedded origin; a remote page cannot reach it.
type Local struct{ a *App }

type Status struct {
	Mode    string `json:"mode"`
	Address string `json:"address"`
	Code    string `json:"code"`
	Version string `json:"version"`
}

type Preview struct {
	Valid bool `json:"valid"`
	Warn  bool `json:"warn"`
}

type ConnectResult struct {
	OK   bool   `json:"ok"`
	Code string `json:"code"`
}

func (l *Local) Boot(origin string) Status { return l.a.boot(origin) }
func (l *Local) Reload()                   { l.a.reload() }
func (l *Local) Back()                     { l.a.showLocal(false) }
func (l *Local) Zoom(dir int)              { l.a.zoom(dir) }

func (l *Local) Preview(addr string) Preview {
	_, warn, err := normalizeAddress(addr)
	return Preview{Valid: err == nil, Warn: warn}
}

func (l *Local) Connect(addr string) ConnectResult {
	base, _, err := normalizeAddress(addr)
	if err != nil {
		return ConnectResult{Code: "bad_address"}
	}
	final, code := checkServer(l.a.ctx, base, healthTimeout)
	if code != codeOK {
		return ConnectResult{Code: code}
	}
	l.a.mu.Lock()
	l.a.cfg.Address = final
	l.a.forceSetup = false
	l.a.saveLocked()
	l.a.mu.Unlock()
	l.a.open(final)
	return ConnectResult{OK: true}
}

func (a *App) boot(origin string) Status {
	a.mu.Lock()
	a.local = true
	a.localOrigin = origin
	addr, force := a.cfg.Address, a.forceSetup
	a.mu.Unlock()
	st := Status{Mode: "setup", Address: addr, Version: a.version}
	if addr != "" && !force {
		final, code := checkServer(a.ctx, addr, healthTimeout)
		if code == codeOK {
			a.open(final)
			st.Mode = "connected"
			return st
		}
		st.Mode, st.Code = "error", code
	}
	a.setMode(st.Mode)
	return st
}

func (a *App) setMode(m string) {
	a.mu.Lock()
	a.mode = m
	a.mu.Unlock()
}

func (a *App) open(base string) {
	a.mu.Lock()
	a.local, a.mode = false, "connected"
	a.mu.Unlock()
	url, _ := json.Marshal(base + "/")
	runtime.WindowExecJS(a.ctx, "location.replace("+string(url)+")")
}

// showLocal returns to the embedded page; Boot then decides which screen to draw.
func (a *App) showLocal(setup bool) {
	a.mu.Lock()
	a.local, a.forceSetup = true, setup
	a.mu.Unlock()
	runtime.WindowReloadApp(a.ctx)
}

func (a *App) reload() {
	a.mu.Lock()
	local, addr := a.local, a.cfg.Address
	a.mu.Unlock()
	if local {
		runtime.WindowReloadApp(a.ctx)
		return
	}
	if _, code := checkServer(a.ctx, addr, healthTimeout); code != codeOK {
		a.showLocal(false)
		return
	}
	runtime.WindowExecJS(a.ctx, "location.reload()")
}

func (a *App) serverAddress() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.cfg.Address
}

func (a *App) zoom(dir int) {
	a.mu.Lock()
	z := a.cfg.Zoom + float64(dir)*zoomStep
	if dir == 0 {
		z = 1
	}
	a.cfg.Zoom = min(max(z, minZoom), maxZoom)
	a.saveLocked()
	a.mu.Unlock()
	a.applyZoom()
}

// CSS zoom: Wails v2 has no runtime zoom API, so it is reapplied on every load.
func (a *App) applyZoom() {
	a.mu.Lock()
	z := a.cfg.Zoom
	a.mu.Unlock()
	runtime.WindowExecJS(a.ctx, "document.documentElement.style.zoom="+strconv.FormatFloat(z, 'f', 2, 64))
}

func (a *App) saveLocked() { _ = saveConfig(a.cfgPath, a.cfg) }

// onDomReady runs after every page load, local or remote.
func (a *App) onDomReady(context.Context) {
	a.applyZoom()
	a.mu.Lock()
	local, origin := a.local, a.localOrigin
	a.mu.Unlock()
	if !local {
		runtime.WindowExecJS(a.ctx, bridgeScript(origin, a.token))
	}
}

// watch retries the saved server while the error screen is showing.
func (a *App) watch() {
	for range time.Tick(10 * time.Second) {
		a.mu.Lock()
		retry, addr := a.local && a.mode == "error", a.cfg.Address
		a.mu.Unlock()
		if !retry {
			continue
		}
		if final, code := checkServer(a.ctx, addr, healthTimeout); code == codeOK {
			a.open(final)
		}
	}
}

// trackWindow remembers the normal (not maximised or minimised) bounds.
func (a *App) trackWindow() {
	for range time.Tick(2 * time.Second) {
		if !runtime.WindowIsNormal(a.ctx) {
			continue
		}
		w, h := runtime.WindowGetSize(a.ctx)
		x, y := runtime.WindowGetPosition(a.ctx)
		a.mu.Lock()
		cur := a.cfg.Window
		if cur.Width != w || cur.Height != h || cur.X == nil || *cur.X != x || *cur.Y != y {
			a.cfg.Window = WindowState{Width: w, Height: h, X: &x, Y: &y, Maximised: cur.Maximised}
			a.saveLocked()
		}
		a.mu.Unlock()
	}
}

func (a *App) onBeforeClose(context.Context) bool {
	a.mu.Lock()
	a.cfg.Window.Maximised = runtime.WindowIsMaximised(a.ctx)
	a.saveLocked()
	a.mu.Unlock()
	return false
}

func (a *App) onStartup(ctx context.Context) {
	a.ctx = ctx
	if w := a.cfg.Window; w.X != nil && w.Y != nil {
		runtime.WindowSetPosition(ctx, *w.X, *w.Y)
	}
	go a.watch()
	go a.trackWindow()
}

func (a *App) onSecondLaunch() {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
	runtime.WindowSetAlwaysOnTop(a.ctx, true) // the only reliable way to steal focus on Windows
	runtime.WindowSetAlwaysOnTop(a.ctx, false)
}
