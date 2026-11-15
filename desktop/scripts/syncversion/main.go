// Command syncversion copies "version" from the repo's package.json into
// wails.json (info.productVersion). Run from desktop/: go run ./scripts/syncversion
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"regexp"
)

func main() {
	raw, err := os.ReadFile("../package.json")
	if err != nil {
		log.Fatal(err)
	}
	var pkg struct {
		Version string `json:"version"`
	}
	if err := json.Unmarshal(raw, &pkg); err != nil || pkg.Version == "" {
		log.Fatal("package.json has no version")
	}
	cfg, err := os.ReadFile("wails.json")
	if err != nil {
		log.Fatal(err)
	}
	re := regexp.MustCompile(`("productVersion"\s*:\s*)"[^"]*"`)
	if !re.Match(cfg) {
		log.Fatal("wails.json has no productVersion")
	}
	out := re.ReplaceAll(cfg, []byte(`${1}"`+pkg.Version+`"`))
	if err := os.WriteFile("wails.json", out, 0o644); err != nil {
		log.Fatal(err)
	}
	fmt.Println("productVersion =", pkg.Version)
}
