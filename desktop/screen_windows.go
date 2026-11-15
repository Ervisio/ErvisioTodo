package main

import "syscall"

// virtualScreen is the bounding box of all monitors in physical pixels.
// Wails' own Screen type has no origin, which multi-monitor clamping needs.
func virtualScreen() rect {
	gsm := syscall.NewLazyDLL("user32.dll").NewProc("GetSystemMetrics")
	get := func(i uintptr) int {
		v, _, _ := gsm.Call(i)
		return int(int32(v))
	}
	return rect{X: get(76), Y: get(77), W: get(78), H: get(79)}
}
