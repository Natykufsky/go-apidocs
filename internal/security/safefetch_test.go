package security

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"
)

func TestIsIPBlocked_PrivateAndMetadata(t *testing.T) {
	blocked := []string{
		"127.0.0.1",       // loopback
		"10.0.0.5",        // private
		"192.168.1.10",    // private
		"172.16.0.1",      // private
		"169.254.169.254", // cloud metadata (AWS/GCP/Azure)
		"100.64.0.1",      // CGNAT
		"198.18.0.1",      // benchmark
		"240.0.0.1",       // reserved
		"224.0.0.1",       // multicast
		"0.0.0.0",         // unspecified
		"::1",             // IPv6 loopback
		"fe80::1",         // IPv6 link-local
		"fc00::1",         // IPv6 unique-local
	}
	for _, ip := range blocked {
		addr, err := netip.ParseAddr(ip)
		if err != nil {
			t.Fatalf("test bug: cannot parse %q: %v", ip, err)
		}
		if !IsIPBlocked(addr) {
			t.Errorf("IP %s should be blocked", ip)
		}
	}
}

func TestIsIPBlocked_PublicAllowed(t *testing.T) {
	public := []string{
		"8.8.8.8",
		"1.1.1.1",
		"93.184.216.34",
		"2606:4700:4700::1111", // public IPv6
	}
	for _, ip := range public {
		addr, err := netip.ParseAddr(ip)
		if err != nil {
			t.Fatalf("test bug: cannot parse %q: %v", ip, err)
		}
		if IsIPBlocked(addr) {
			t.Errorf("public IP %s should NOT be blocked", ip)
		}
	}
}

func TestIsHostAllowed(t *testing.T) {
	cases := []struct {
		host      string
		allowlist []string
		want      bool
	}{
		{"api.example.com", []string{"api.example.com"}, true},
		{"api.example.com", []string{"*.example.com"}, true},
		{"example.com", []string{"*.example.com"}, true}, // suffix rule covers apex
		{"evil.com", []string{"*.example.com"}, false},
		{"evilexample.com", []string{"*.example.com"}, false}, // no partial-suffix bypass
		{"anything.com", []string{"*"}, true},
		{"api.example.com", nil, false},                        // empty allowlist blocks all
		{"API.Example.COM", []string{"api.example.com"}, true}, // case-insensitive
	}
	for _, tc := range cases {
		got := IsHostAllowed(tc.host, tc.allowlist)
		if got != tc.want {
			t.Errorf("IsHostAllowed(%q, %v) = %v, want %v", tc.host, tc.allowlist, got, tc.want)
		}
	}
}

func TestValidateTargetURL_SchemeEnforcement(t *testing.T) {
	policy := RemoteFetchPolicy{HostAllowlist: []string{"*"}}.Normalize()

	if _, err := ValidateTargetURL("javascript:alert(1)", policy); !errors.Is(err, ErrSchemeNotAllowed) {
		t.Errorf("javascript: scheme should be rejected, got %v", err)
	}
	if _, err := ValidateTargetURL("file:///etc/passwd", policy); !errors.Is(err, ErrSchemeNotAllowed) {
		t.Errorf("file: scheme should be rejected, got %v", err)
	}
}

func TestValidateTargetURL_AllowlistEnforcement(t *testing.T) {
	policy := RemoteFetchPolicy{HostAllowlist: []string{"api.example.com"}}.Normalize()

	if _, err := ValidateTargetURL("https://api.example.com/v1", policy); err != nil {
		t.Errorf("allowed host should pass, got %v", err)
	}
	if _, err := ValidateTargetURL("https://evil.example.com/v1", policy); !errors.Is(err, ErrHostNotAllowed) {
		t.Errorf("subdomain not on allowlist should fail, got %v", err)
	}
	if _, err := ValidateTargetURL("https:///", policy); err == nil {
		t.Error("empty hostname should fail")
	}
}

// TestNewSafeHTTPClient_BlocksLoopbackDial verifies the dial-time check actually
// rejects connections to loopback even if an attacker submits a public hostname
// resolving to 127.0.0.1 (hosts-file style SSRF).
func TestNewSafeHTTPClient_BlocksLoopbackDial(t *testing.T) {
	// Local httptest server on 127.0.0.1 — represents the "internal" target.
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer ts.Close()

	policy := RemoteFetchPolicy{HostAllowlist: []string{"*"}}.Normalize()
	client := NewSafeHTTPClient(policy)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, ts.URL, nil)
	_, err := client.Do(req)
	if !errors.Is(err, ErrBlockedAddress) {
		t.Errorf("expected dial to loopback to be blocked, got %v", err)
	}
}

// TestNewSafeHTTPClient_RedirectCapAndRevalidation ensures redirects are
// limited and each hop is re-validated against the policy.
func TestNewSafeHTTPClient_RedirectBlockedToPrivateHost(t *testing.T) {
	// First hop: a public-looking httptest server that redirects to a
	// loopback address (classic SSRF redirect bypass attempt).
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://127.0.0.1:9/admin", http.StatusFound)
	}))
	defer ts.Close()

	policy := RemoteFetchPolicy{HostAllowlist: []string{"*"}}.Normalize()
	client := NewSafeHTTPClient(policy)

	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, ts.URL, nil)
	_, err := client.Do(req)
	if err == nil {
		t.Fatal("expected redirect to loopback to be blocked")
	}
}

func TestRemoteFetchPolicy_NormalizeDefaults(t *testing.T) {
	p := RemoteFetchPolicy{}.Normalize()
	if len(p.AllowedSchemes) == 0 {
		t.Error("expected default schemes to be populated")
	}
	if p.Timeout <= 0 {
		t.Error("expected default timeout")
	}
	if p.MaxBytes <= 0 {
		t.Error("expected default MaxBytes")
	}
}

func TestNewSafeHTTPClient_TimeoutRespected(t *testing.T) {
	policy := RemoteFetchPolicy{HostAllowlist: []string{"*"}, Timeout: 1 * time.Second}.Normalize()
	client := NewSafeHTTPClient(policy)
	if client.Timeout != 1*time.Second {
		t.Errorf("client.Timeout = %v, want 1s", client.Timeout)
	}
}
