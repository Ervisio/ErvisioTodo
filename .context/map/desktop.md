# Desktop client (desktop/)
Purpose: thin native Windows window around a self-hosted server. No bundled server.
Stack: Wails v2.17 + Go 1.26 + WebView2. Own go.mod in desktop/. No Node/Rust/MSVC needed.
Why Wails: Go and the wails CLI were already installed; Rust/MSVC were not.

Files: main.go (options, embed), app.go (state, bindings `Local`, boot/reload/zoom), bridge.go
(remote-page script + 204 handler), menu.go, health.go (GET /api/public), urlnorm.go, config.go,
winstate.go (clamp), screen_windows.go (virtual screen), frontend/dist/index.html (hand-written, tracked),
scripts/genicon + scripts/syncversion (`go run ./scripts/...` from desktop/).
Version: wails.json info.productVersion (embedded, shown in About); syncversion copies package.json.

Flow: local page calls Boot -> saved address health-checked (5s) -> ExecJS location.replace(server).
Failure -> error screen (Riprova / Cambia server); Go ticker retries every 10s while it shows.
Reload (menu, Ctrl+R, F5) health-checks first. "Cambia server" = showLocal(true) = WindowReloadApp + Boot.

Config: %APPDATA%\ErvisioTodo\config.json (address, zoom, window), atomic write, corrupt -> .bad.
WebView2 profile: %APPDATA%\ErvisioTodo\webview (login session survives restarts).
Build: `cd desktop && wails build` -> build/bin/ErvisioTodo.exe (~11 MB). `-nsis` needs makensis (absent locally).
Tests: `go test ./... && go vet ./...` in desktop/ (pure logic only).

Traps (verified on Wails 2.17):
- Remote pages get no `window.go`/`window.wails` at all, and Wails drops their messages: bindings are safe.
- Wails v2 has no new-window, navigation or download hook. External links, F5/Ctrl+R and zoom keys in
  the remote page go through an injected script that navigates to http://wails.localhost/__x/<token>/...;
  the asset Handler answers 204 so the page stays put. fetch/img are blocked by the app's CSP (connect-src 'self').
- Wails menu accelerators lack plain "=" and "-": shortcuts are key listeners; menu labels only show them.
- Zoom is CSS `zoom` on <html>, reapplied on every DomReady (no runtime zoom API).
- Downloads work out of the box: WebView2 saves to Downloads and shows its flyout.
- Same-origin target=_blank (attachments) opens a WebView2 popup window; cannot be intercepted.
- Navigation away from the server by redirect/location is not intercepted; menu bar is not dark themed.
- ReloadApp navigates to the embedded start URL; Boot(origin) records it (wails dev uses another host).
