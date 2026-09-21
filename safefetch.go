package apidocs

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"time"
)

var (
	// ErrBlockedAddress is returned when a requested IP address is in a forbidden private or loopback range.
	ErrBlockedAddress = errors.New("address resolution blocked by security policy")
	// ErrSchemeNotAllowed is returned when a URL scheme is not in the allowed schemes list.
	ErrSchemeNotAllowed = errors.New("url scheme not permitted")
	// ErrHostNotAllowed is returned when a host does not match the configured HostAllowlist.
	ErrHostNotAllowed = errors.New("host not permitted by allowlist")
	// ErrRemoteFetchDisabled is returned when remote fetching is attempted but disabled.
	ErrRemoteFetchDisabled = errors.New("remote fetch is disabled")
)

// RemoteFetchPolicy defines SSRF security constraints for outbound HTTP requests.
type RemoteFetchPolicy struct {
	Enabled        bool          `json:"enabled"`
	AllowedSchemes []string      `json:"allowed_schemes"` // default: ["https"]
	HostAllowlist  []string      `json:"host_allowlist"`  // exact or wildcard *.domain.com - empty means deny all
	MaxBytes       int64         `json:"max_bytes"`       // default 5 MiB
	Timeout        time.Duration `json:"timeout"`         // default 5s
	MaxRedirects   int           `json:"max_redirects"`   // default 0 (no redirects)
}

// Normalize applies secure defaults to a RemoteFetchPolicy.
func (p RemoteFetchPolicy) Normalize() RemoteFetchPolicy {
	if len(p.AllowedSchemes) == 0 {
		p.AllowedSchemes = []string{"https"}
	}
	if p.MaxBytes <= 0 {
		p.MaxBytes = 5 << 20 // 5 MiB
	}
	if p.Timeout <= 0 {
		p.Timeout = 5 * time.Second
	}
	return p
}

// isIPBlocked checks if an IP belongs to private, loopback, link-local, multicast, or cloud metadata ranges.
func isIPBlocked(ip netip.Addr) bool {
	ip = ip.Unmap()

	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}

	// Block CGNAT, Cloud Metadata (AWS/GCP/Azure 169.254.169.254), benchmark, and reserved ranges
	blockedPrefixes := []string{
		"100.64.0.0/10",  // Shared address space (CGNAT)
		"169.254.0.0/16", // Link-local & Cloud Metadata (169.254.169.254)
		"192.0.0.0/24",   // IETF Protocol Assignments
		"198.18.0.0/15",  // Benchmark testing
		"240.0.0.0/4",    // Reserved for future use
	}

	for _, prefixStr := range blockedPrefixes {
		prefix, err := netip.ParsePrefix(prefixStr)
		if err == nil && prefix.Contains(ip) {
			return true
		}
	}

	return false
}

// isHostAllowed checks if the target hostname matches the configured host allowlist.
func isHostAllowed(hostname string, allowlist []string) bool {
	if len(allowlist) == 0 {
		return false
	}
	h := strings.ToLower(hostname)
	for _, pattern := range allowlist {
		p := strings.ToLower(pattern)
		if p == "*" {
			return true
		}
		if p == h {
			return true
		}
		if strings.HasPrefix(p, "*.") {
			domain := p[2:]
			if strings.HasSuffix(h, domain) && (h == domain || strings.HasSuffix(h, "."+domain)) {
				return true
			}
		}
	}
	return false
}

// ValidateTargetURL verifies URL scheme and allowlist constraints before dialing.
func ValidateTargetURL(rawURL string, policy RemoteFetchPolicy) (*url.URL, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid url: %w", err)
	}

	// Validate scheme
	schemeAllowed := false
	for _, s := range policy.AllowedSchemes {
		if strings.EqualFold(u.Scheme, s) {
			schemeAllowed = true
			break
		}
	}
	if !schemeAllowed {
		return nil, fmt.Errorf("%w: %s (allowed: %v)", ErrSchemeNotAllowed, u.Scheme, policy.AllowedSchemes)
	}

	// Validate host allowlist
	hostname := u.Hostname()
	if hostname == "" {
		return nil, errors.New("empty hostname in url")
	}
	if !isHostAllowed(hostname, policy.HostAllowlist) {
		return nil, fmt.Errorf("%w: %s", ErrHostNotAllowed, hostname)
	}

	return u, nil
}

// newSafeHTTPClient returns an http.Client with dial-time IP filtering to defeat SSRF and DNS rebinding attacks.
func newSafeHTTPClient(policy RemoteFetchPolicy) *http.Client {
	policy = policy.Normalize()

	dialer := &net.Dialer{
		Timeout:   3 * time.Second,
		KeepAlive: -1, // Disable keep-alive for security probes
	}

	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}

			// Resolve host IPs
			ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
			if err != nil {
				return nil, fmt.Errorf("dns lookup failed for %s: %w", host, err)
			}
			if len(ips) == 0 {
				return nil, fmt.Errorf("no ip addresses resolved for %s", host)
			}

			// Check all resolved IPs against the blocked ranges
			for _, ip := range ips {
				if isIPBlocked(ip) {
					return nil, fmt.Errorf("%w: %s resolved to forbidden address %s", ErrBlockedAddress, host, ip)
				}
			}

			// Dial the checked IP directly to defeat DNS rebinding attacks
			targetAddr := net.JoinHostPort(ips[0].String(), port)
			return dialer.DialContext(ctx, network, targetAddr)
		},
		TLSHandshakeTimeout:   3 * time.Second,
		ResponseHeaderTimeout: 3 * time.Second,
		DisableKeepAlives:     true,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   policy.Timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= policy.MaxRedirects {
				return http.ErrUseLastResponse
			}
			// Verify redirected URL
			_, err := ValidateTargetURL(req.URL.String(), policy)
			if err != nil {
				return fmt.Errorf("redirect blocked: %w", err)
			}
			return nil
		},
	}
}
