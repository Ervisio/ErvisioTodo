package main

import "testing"

func ip(v int) *int { return &v }

func TestClampWindow(t *testing.T) {
	screen := rect{0, 0, 1920, 1080}
	cases := []struct {
		name       string
		in         WindowState
		w, h, x, y int // x = -1: position stays unset
	}{
		{"inside", WindowState{Width: 1000, Height: 700, X: ip(100), Y: ip(50)}, 1000, 700, 100, 50},
		{"off right", WindowState{Width: 1000, Height: 700, X: ip(3000), Y: ip(50)}, 1000, 700, 920, 50},
		{"off left/top", WindowState{Width: 1000, Height: 700, X: ip(-5000), Y: ip(-200)}, 1000, 700, 0, 0},
		{"minimised coords", WindowState{Width: 1000, Height: 700, X: ip(-32000), Y: ip(-32000)}, 1000, 700, 0, 0},
		{"too big", WindowState{Width: 4000, Height: 3000, X: ip(0), Y: ip(0)}, 1920, 1080, 0, 0},
		{"too small", WindowState{Width: 100, Height: 100}, defaultWidth, defaultHeight, -1, -1},
		{"zero value", WindowState{}, defaultWidth, defaultHeight, -1, -1},
	}
	for _, c := range cases {
		got := clampWindow(c.in, screen)
		if got.Width != c.w || got.Height != c.h {
			t.Errorf("%s: size %dx%d, want %dx%d", c.name, got.Width, got.Height, c.w, c.h)
		}
		if c.x == -1 {
			if got.X != nil || got.Y != nil {
				t.Errorf("%s: position should stay unset", c.name)
			}
		} else if got.X == nil || *got.X != c.x || *got.Y != c.y {
			t.Errorf("%s: position wrong: %+v", c.name, got)
		}
	}
}

func TestClampWindowSecondMonitorLeft(t *testing.T) {
	screen := rect{-1920, 0, 3840, 1080}
	got := clampWindow(WindowState{Width: 1000, Height: 700, X: ip(-1500), Y: ip(100)}, screen)
	if *got.X != -1500 {
		t.Errorf("window on left monitor was moved: %d", *got.X)
	}
}

func TestClampWindowUnknownScreen(t *testing.T) {
	got := clampWindow(WindowState{Width: 1000, Height: 700, X: ip(5000), Y: ip(5000)}, rect{})
	if *got.X != 5000 {
		t.Errorf("should not clamp without screen info")
	}
}
