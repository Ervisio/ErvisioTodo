package main

import (
	"errors"
	"net"
	"net/url"
	"strings"
)

var errBadAddress = errors.New("bad address")

// normalizeAddress turns user input into a bare origin (scheme://host[:port]).
// warn is true for plain http on a host that is not a local or private network.
func normalizeAddress(input string) (base string, warn bool, err error) {
	s := strings.TrimSpace(input)
	if s == "" {
		return "", false, errBadAddress
	}
	if !strings.Contains(s, "://") {
		s = "https://" + s
	}
	u, err := url.Parse(s)
	if err != nil || u.Hostname() == "" || u.User != nil {
		return "", false, errBadAddress
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", false, errBadAddress
	}
	base = u.Scheme + "://" + u.Host
	return base, u.Scheme == "http" && !isPrivateHost(u.Hostname()), nil
}

func isPrivateHost(host string) bool {
	h := strings.ToLower(strings.TrimSuffix(host, "."))
	if h == "localhost" || strings.HasSuffix(h, ".local") || strings.HasSuffix(h, ".localhost") {
		return true
	}
	ip := net.ParseIP(h)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate())
}
