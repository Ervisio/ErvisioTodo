package main

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Wails maps menu accelerators to a fixed key table that has no plain "=" or
// "-", so shortcuts are handled by key listeners (see bridge.go, index.html)
// and only shown in the labels.
func (a *App) buildMenu() *menu.Menu {
	item := func(label string, fn func()) *menu.MenuItem {
		return menu.Text(label, nil, func(*menu.CallbackData) { go fn() })
	}
	m := menu.NewMenu()
	server := m.AddSubmenu("Server")
	server.Append(item("Cambia server…", func() { a.showLocal(true) }))
	server.Append(item("Ricarica\tCtrl+R / F5", a.reload))
	server.Append(item("Apri nel browser", func() {
		if addr := a.serverAddress(); addr != "" {
			runtime.BrowserOpenURL(a.ctx, addr)
		}
	}))
	server.AddSeparator()
	server.Append(item("Esci", func() { runtime.Quit(a.ctx) }))

	view := m.AddSubmenu("Visualizza")
	view.Append(item("Ingrandisci\tCtrl+=", func() { a.zoom(1) }))
	view.Append(item("Riduci\tCtrl+-", func() { a.zoom(-1) }))
	view.Append(item("Zoom predefinito\tCtrl+0", func() { a.zoom(0) }))

	help := m.AddSubmenu("?")
	help.Append(item("Informazioni", a.about))
	return m
}

func (a *App) about() {
	_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:    runtime.InfoDialog,
		Title:   "Informazioni",
		Message: "ErvisioTodo Desktop\nVersione " + a.version,
	})
}
