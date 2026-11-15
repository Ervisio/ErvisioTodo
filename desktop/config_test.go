package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sub", "config.json")
	x, y := 10, 20
	in := Config{Address: "https://a.example", Zoom: 1.2, Window: WindowState{Width: 1000, Height: 700, X: &x, Y: &y, Maximised: true}}
	if err := saveConfig(path, in); err != nil {
		t.Fatal(err)
	}
	if err := saveConfig(path, in); err != nil { // overwrite existing
		t.Fatal(err)
	}
	out := loadConfig(path)
	if out.Address != in.Address || out.Zoom != 1.2 || out.Window.Width != 1000 || *out.Window.X != 10 || !out.Window.Maximised {
		t.Errorf("round trip mismatch: %+v", out)
	}
	entries, _ := os.ReadDir(filepath.Dir(path))
	if len(entries) != 1 {
		t.Errorf("temp files left behind: %v", entries)
	}
}

func TestConfigMissingGivesDefaults(t *testing.T) {
	cfg := loadConfig(filepath.Join(t.TempDir(), "nope.json"))
	if cfg.Window.Width != defaultWidth || cfg.Zoom != 1 || cfg.Address != "" {
		t.Errorf("unexpected defaults: %+v", cfg)
	}
}

func TestConfigCorruptIsMovedAside(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := loadConfig(path)
	if cfg.Window.Width != defaultWidth {
		t.Errorf("want defaults, got %+v", cfg)
	}
	if _, err := os.Stat(path + ".bad"); err != nil {
		t.Errorf("corrupt file not preserved: %v", err)
	}
	if err := saveConfig(path, cfg); err != nil {
		t.Errorf("save after recovery: %v", err)
	}
}

func TestConfigBadZoomResets(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	_ = os.WriteFile(path, []byte(`{"zoom":99}`), 0o600)
	if z := loadConfig(path).Zoom; z != 1 {
		t.Errorf("zoom %v", z)
	}
}
