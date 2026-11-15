# ErvisioTodo Desktop

A thin native Windows window (Wails v2 + Go + WebView2) around your own
ErvisioTodo server. It bundles no server: on first run it asks for the server
address, checks `GET /api/public`, saves it and opens the web app.

## Requirements
Go 1.26+, Wails CLI v2 (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`),
WebView2 runtime (preinstalled on Windows 11). No Node, Rust or MSVC needed.
Optional: NSIS (`makensis`) for the installer.

## Develop and build
    cd desktop
    wails dev                 # live run
    wails build               # -> build/bin/ErvisioTodo.exe (no console window)
    wails build -nsis         # installer, needs makensis
    go test ./... && go vet ./...
    go run ./scripts/syncversion   # copy package.json version into wails.json
    go run ./scripts/genicon       # redraw build/appicon.png and icon.ico

`frontend/dist` is hand-written HTML (no build step) and is committed.

## Where data lives
- `%APPDATA%\ErvisioTodo\config.json`: server address, zoom, window bounds.
- `%APPDATA%\ErvisioTodo\webview`: WebView2 profile (login session, cookies).
Delete the folder to reset the app.

## Releases
A tag `vX.Y.Z` runs the release workflow; on `windows-latest` it runs
syncversion, `wails build -nsis` and uploads the installer and exe to the release.
