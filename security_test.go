package apidocs

import (
	"encoding/json"
	"net/netip"
	"testing"
)

func TestSSRF_BlockedIPs(t *testing.T) {
	testCases := []struct {
		ip      string
		blocked bool
	}{
		{"127.0.0.1", true},       // Loopback IPv4
		{"::1", true},             // Loopback IPv6
		{"10.0.0.1", true},        // RFC1918 Private Class A
		{"172.16.0.1", true},      // RFC1918 Private Class B
		{"192.168.1.1", true},     // RFC1918 Private Class C
		{"169.254.169.254", true}, // AWS / Cloud Metadata
		{"100.64.0.1", true},      // CGNAT
		{"224.0.0.1", true},       // Multicast
		{"8.8.8.8", false},        // Public Google DNS
		{"1.1.1.1", false},        // Public Cloudflare DNS
	}

	for _, tc := range testCases {
		ip, err := netip.ParseAddr(tc.ip)
		if err != nil {
			t.Fatalf("failed parsing ip %s: %v", tc.ip, err)
		}
		result := isIPBlocked(ip)
		if result != tc.blocked {
			t.Errorf("ip %s: expected blocked=%v, got %v", tc.ip, tc.blocked, result)
		}
	}
}

func TestSSRF_HostAllowlist(t *testing.T) {
	allowlist := []string{"api.example.com", "*.trusted.org"}

	if !isHostAllowed("api.example.com", allowlist) {
		t.Error("expected api.example.com to be allowed")
	}
	if !isHostAllowed("sub.trusted.org", allowlist) {
		t.Error("expected sub.trusted.org to be allowed")
	}
	if !isHostAllowed("trusted.org", allowlist) {
		t.Error("expected trusted.org to be allowed")
	}
	if isHostAllowed("evil.com", allowlist) {
		t.Error("expected evil.com to be rejected")
	}
	if isHostAllowed("nottrusted.org.evil.com", allowlist) {
		t.Error("expected nottrusted.org.evil.com to be rejected")
	}
}

func TestSecurity_StaticSpecAnalysis(t *testing.T) {
	specJSON := `{
		"openapi": "3.0.0",
		"info": {"title": "Test Security API", "version": "1.0.0"},
		"paths": {
			"/users": {
				"post": {
					"description": "Creates user with token AKIAIOSFODNN7EXAMPLE",
					"responses": {"201": {"description": "created"}}
				}
			}
		}
	}`

	var specMap map[string]any
	if err := json.Unmarshal([]byte(specJSON), &specMap); err != nil {
		t.Fatal(err)
	}

	result := AnalyzeSpecSecurity(specMap)

	if result.CriticalCount == 0 {
		t.Error("expected critical findings for AWS key leak")
	}
	if result.WarningCount == 0 {
		t.Error("expected warning for unprotected POST operation")
	}
	if result.Score >= 100 {
		t.Errorf("expected score reduction, got %d", result.Score)
	}
	if len(result.FuzzingPresets) == 0 {
		t.Error("expected default fuzzing presets to be populated")
	}
}
