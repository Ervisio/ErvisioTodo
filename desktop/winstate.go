package main

const (
	defaultWidth  = 1280
	defaultHeight = 800
	minWidth      = 900
	minHeight     = 600
)

type rect struct{ X, Y, W, H int }

// clampWindow keeps a restored window inside the visible desktop (the bounding
// box of all monitors), so unplugging a monitor never strands it off screen.
func clampWindow(w WindowState, screen rect) WindowState {
	if w.Width < minWidth || w.Height < minHeight {
		w.Width, w.Height = defaultWidth, defaultHeight
	}
	if screen.W <= 0 || screen.H <= 0 {
		return w
	}
	w.Width = min(w.Width, max(screen.W, minWidth))
	w.Height = min(w.Height, max(screen.H, minHeight))
	if w.X != nil && w.Y != nil {
		x := clampInt(*w.X, screen.X, screen.X+screen.W-w.Width)
		y := clampInt(*w.Y, screen.Y, screen.Y+screen.H-w.Height)
		w.X, w.Y = &x, &y
	}
	return w
}

func clampInt(v, lo, hi int) int {
	if hi < lo {
		return lo
	}
	return min(max(v, lo), hi)
}
