package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const goodBody = `{"success":true,"data":{"siteName":"Todo"}}`

func jsonOK(body string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}
}

func TestCheckServer(t *testing.T) {
	cases := []struct {
		name string
		h    http.HandlerFunc
		want string
	}{
		{"ok", jsonOK(goodBody), codeOK},
		{"html 200", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte("<html>hi</html>"))
		}, codeNotErvisio},
		{"json without envelope", jsonOK(`{"hello":1}`), codeNotErvisio},
		{"json array", jsonOK(`[1]`), codeNotErvisio},
		{"404", http.NotFound, codeNotErvisio},
		{"slow", func(w http.ResponseWriter, r *http.Request) { time.Sleep(600 * time.Millisecond) }, codeTimeout},
	}
	for _, c := range cases {
		srv := httptest.NewServer(c.h)
		_, code := checkServer(t.Context(), srv.URL, 300*time.Millisecond)
		srv.Close()
		if code != c.want {
			t.Errorf("%s: got %s, want %s", c.name, code, c.want)
		}
	}
}

func TestCheckServerUnreachable(t *testing.T) {
	srv := httptest.NewServer(jsonOK(goodBody))
	base := srv.URL
	srv.Close()
	if _, code := checkServer(t.Context(), base, time.Second); code != codeUnreachable {
		t.Errorf("got %s", code)
	}
}

func TestCheckServerHTTPSToPlainServer(t *testing.T) {
	srv := httptest.NewServer(jsonOK(goodBody))
	defer srv.Close()
	_, code := checkServer(t.Context(), strings.Replace(srv.URL, "http://", "https://", 1), time.Second)
	if code != codeCertificate {
		t.Errorf("got %s", code)
	}
}

func TestCheckServerUntrustedCertificate(t *testing.T) {
	srv := httptest.NewTLSServer(jsonOK(goodBody))
	defer srv.Close()
	if _, code := checkServer(t.Context(), srv.URL, time.Second); code != codeCertificate {
		t.Errorf("got %s", code)
	}
}

func TestCheckServerSameHostRedirect(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/public", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/api/real", http.StatusFound)
	})
	mux.HandleFunc("/api/real", jsonOK(goodBody))
	srv := httptest.NewServer(mux)
	defer srv.Close()
	if final, code := checkServer(t.Context(), srv.URL, time.Second); code != codeOK || final != srv.URL {
		t.Errorf("got %s %s", final, code)
	}
}

func TestCheckServerCrossHostRedirect(t *testing.T) {
	target := httptest.NewServer(jsonOK(goodBody))
	defer target.Close()
	// 127.0.0.1 and localhost are different hosts: the redirect must not be followed.
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, strings.Replace(target.URL, "127.0.0.1", "localhost", 1)+"/api/public", http.StatusFound)
	}))
	defer other.Close()
	if _, code := checkServer(t.Context(), other.URL, time.Second); code != codeRedirect {
		t.Errorf("got %s", code)
	}
}
