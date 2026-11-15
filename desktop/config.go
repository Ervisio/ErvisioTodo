package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type WindowState struct {
	Width     int  `json:"width"`
	Height    int  `json:"height"`
	X         *int `json:"x,omitempty"`
	Y         *int `json:"y,omitempty"`
	Maximised bool `json:"maximised"`
}

type Config struct {
	Address string      `json:"address"`
	Zoom    float64     `json:"zoom"`
	Window  WindowState `json:"window"`
}

func defaultConfig() Config {
	return Config{Zoom: 1, Window: WindowState{Width: defaultWidth, Height: defaultHeight}}
}

// loadConfig never fails: a missing file gives defaults and a corrupt one is
// moved aside to <path>.bad so the user is not locked out by a bad write.
func loadConfig(path string) Config {
	cfg := defaultConfig()
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		_ = os.Rename(path, path+".bad")
		return defaultConfig()
	}
	if cfg.Zoom < minZoom || cfg.Zoom > maxZoom {
		cfg.Zoom = 1
	}
	return cfg
}

// saveConfig writes to a temp file in the same folder, then renames over the
// target so a crash never leaves a half-written config.json.
func saveConfig(path string, cfg Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), "config-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
