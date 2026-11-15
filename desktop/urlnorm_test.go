package main

import "testing"

func TestNormalizeAddress(t *testing.T) {
	cases := []struct {
		in, base string
		warn, ok bool
	}{
		{"todo.example.com", "https://todo.example.com", false, true},
		{"  https://todo.example.com/  ", "https://todo.example.com", false, true},
		{"https://todo.example.com/app/login?x=1#y", "https://todo.example.com", false, true},
		{"HTTPS://Todo.Example.com:8443/", "https://Todo.Example.com:8443", false, true},
		{"http://192.168.1.10:3000", "http://192.168.1.10:3000", false, true},
		{"http://localhost:3137/", "http://localhost:3137", false, true},
		{"http://127.0.0.2", "http://127.0.0.2", false, true},
		{"http://10.1.2.3", "http://10.1.2.3", false, true},
		{"http://172.16.0.1", "http://172.16.0.1", false, true},
		{"http://172.31.255.1", "http://172.31.255.1", false, true},
		{"http://172.32.0.1", "http://172.32.0.1", true, true},
		{"http://nas.local", "http://nas.local", false, true},
		{"http://todo.example.com", "http://todo.example.com", true, true},
		{"http://[::1]:3000", "http://[::1]:3000", false, true},
		{"", "", false, false},
		{"   ", "", false, false},
		{"ftp://example.com", "", false, false},
		{"https://user:pw@example.com", "", false, false},
		{"https://", "", false, false},
		{"http://exa mple.com", "", false, false},
	}
	for _, c := range cases {
		base, warn, err := normalizeAddress(c.in)
		if (err == nil) != c.ok || base != c.base || warn != c.warn {
			t.Errorf("%q: got (%q, %v, %v), want (%q, %v, ok=%v)", c.in, base, warn, err, c.base, c.warn, c.ok)
		}
	}
}
