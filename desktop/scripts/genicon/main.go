// Command genicon draws the app icon (accent rounded square, white check) and
// writes build/appicon.png and build/windows/icon.ico. Run from desktop/:
// go run ./scripts/genicon
package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"log"
	"math"
	"os"
	"path/filepath"
)

const ss = 4 // supersampling factor for smooth edges

var accent = color.NRGBA{0x24, 0x5a, 0xc2, 0xff}

// render draws at size*ss, then box-filters down to size.
func render(size int) *image.NRGBA {
	n := size * ss
	big := image.NewNRGBA(image.Rect(0, 0, n, n))
	f := float64(n)
	radius := f * 0.22
	pts := [3][2]float64{{0.27, 0.52}, {0.43, 0.68}, {0.73, 0.34}}
	for y := 0; y < n; y++ {
		for x := 0; x < n; x++ {
			px, py := float64(x)+0.5, float64(y)+0.5
			switch {
			case !inRoundRect(px, py, f, radius):
			case onCheck(px, py, f, pts):
				big.SetNRGBA(x, y, color.NRGBA{255, 255, 255, 255})
			default:
				big.SetNRGBA(x, y, accent)
			}
		}
	}
	return downscale(big, size)
}

func inRoundRect(x, y, f, r float64) bool {
	cx := math.Min(math.Max(x, r), f-r)
	cy := math.Min(math.Max(y, r), f-r)
	return math.Hypot(x-cx, y-cy) <= r
}

func onCheck(x, y, f float64, p [3][2]float64) bool {
	half := f * 0.055
	for i := 0; i < 2; i++ {
		ax, ay := p[i][0]*f, p[i][1]*f
		bx, by := p[i+1][0]*f, p[i+1][1]*f
		if distToSegment(x, y, ax, ay, bx, by) <= half {
			return true
		}
	}
	return false
}

func distToSegment(px, py, ax, ay, bx, by float64) float64 {
	dx, dy := bx-ax, by-ay
	t := math.Max(0, math.Min(1, ((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
	return math.Hypot(px-(ax+t*dx), py-(ay+t*dy))
}

func downscale(src *image.NRGBA, size int) *image.NRGBA {
	dst := image.NewNRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			var r, g, b, a int
			for j := 0; j < ss; j++ {
				for i := 0; i < ss; i++ {
					c := src.NRGBAAt(x*ss+i, y*ss+j)
					// premultiply so transparent corners do not bleed black
					r += int(c.R) * int(c.A)
					g += int(c.G) * int(c.A)
					b += int(c.B) * int(c.A)
					a += int(c.A)
				}
			}
			if a == 0 {
				continue
			}
			dst.SetNRGBA(x, y, color.NRGBA{uint8(r / a), uint8(g / a), uint8(b / a), uint8(a / (ss * ss))})
		}
	}
	return dst
}

func encodePNG(img image.Image) []byte {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		log.Fatal(err)
	}
	return buf.Bytes()
}

// writeICO stores each size as an embedded PNG (supported since Windows Vista).
func writeICO(path string, sizes []int) {
	frames := make([][]byte, len(sizes))
	for i, s := range sizes {
		frames[i] = encodePNG(render(s))
	}
	var buf bytes.Buffer
	le := func(v any) { _ = binary.Write(&buf, binary.LittleEndian, v) }
	le(uint16(0))
	le(uint16(1))
	le(uint16(len(sizes)))
	offset := 6 + 16*len(sizes)
	for i, s := range sizes {
		dim := uint8(s) // 256 wraps to 0, which means 256 in ICO
		buf.Write([]byte{dim, dim, 0, 0})
		le(uint16(1))
		le(uint16(32))
		le(uint32(len(frames[i])))
		le(uint32(offset))
		offset += len(frames[i])
	}
	for _, f := range frames {
		buf.Write(f)
	}
	write(path, buf.Bytes())
}

func write(path string, data []byte) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		log.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		log.Fatal(err)
	}
}

func main() {
	write("build/appicon.png", encodePNG(render(512)))
	writeICO("build/windows/icon.ico", []int{256, 128, 64, 48, 32, 16})
}
