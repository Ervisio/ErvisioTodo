package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	codeOK          = "ok"
	codeUnreachable = "unreachable"
	codeNotErvisio  = "not_ervisio"
	codeCertificate = "certificate"
	codeTimeout     = "timeout"
	codeRedirect    = "redirect"
)

const healthTimeout = 5 * time.Second

var errCrossHost = errors.New("redirect to another host")

// checkServer calls GET <base>/api/public. Same-host redirects (http to https)
// are followed and the final origin is returned so it can be saved.
func checkServer(ctx context.Context, base string, timeout time.Duration) (finalBase, code string) {
	host := hostOf(base)
	client := &http.Client{
		Timeout: timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 || req.URL.Hostname() != host {
				return errCrossHost
			}
			return nil
		},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/public", nil)
	if err != nil {
		return base, codeUnreachable
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return base, classifyError(err)
	}
	defer resp.Body.Close()
	final := resp.Request.URL.Scheme + "://" + resp.Request.URL.Host
	if resp.StatusCode != http.StatusOK || !looksLikeErvisio(resp.Body) {
		return final, codeNotErvisio
	}
	return final, codeOK
}

func hostOf(base string) string {
	u, _ := url.Parse(base)
	if u == nil {
		return ""
	}
	return u.Hostname()
}

func looksLikeErvisio(body io.Reader) bool {
	var v struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	err := json.NewDecoder(io.LimitReader(body, 1<<20)).Decode(&v)
	return err == nil && v.Success && v.Data != nil
}

func classifyError(err error) string {
	var (
		unknownCA x509.UnknownAuthorityError
		invalid   x509.CertificateInvalidError
		hostname  x509.HostnameError
		tlsHeader tls.RecordHeaderError
		netErr    net.Error
	)
	switch {
	case errors.Is(err, errCrossHost):
		return codeRedirect
	case errors.As(err, &unknownCA), errors.As(err, &invalid), errors.As(err, &hostname),
		errors.As(err, &tlsHeader), strings.Contains(err.Error(), "tls:"),
		strings.Contains(err.Error(), "HTTP response to HTTPS client"):
		return codeCertificate
	case errors.Is(err, context.DeadlineExceeded), errors.As(err, &netErr) && netErr.Timeout():
		return codeTimeout
	}
	return codeUnreachable
}
