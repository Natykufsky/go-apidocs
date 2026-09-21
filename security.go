package apidocs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// SecurityAuditResult contains both static spec findings and live environment header findings.
type SecurityAuditResult struct {
	Timestamp      time.Time             `json:"timestamp"`
	Score          int                   `json:"score"` // 0 to 100
	Grade          string                `json:"grade"` // A+, A, B, C, D, F
	TotalIssues    int                   `json:"total_issues"`
	CriticalCount  int                   `json:"critical_count"`
	WarningCount   int                   `json:"warning_count"`
	PassCount      int                   `json:"pass_count"`
	StaticFindings []SecurityFinding     `json:"static_findings"`
	HeaderAudit    *HeaderAuditResult    `json:"header_audit,omitempty"`
	FuzzingPresets []FuzzingPresetGroup  `json:"fuzzing_presets"`
}

// SecurityFinding represents an identified vulnerability or compliance gap.
type SecurityFinding struct {
	ID          string `json:"id"`
	Category    string `json:"category"` // "Authentication", "Data Exposure", "Input Validation", "Security Headers"
	Severity    string `json:"severity"` // "CRITICAL", "WARNING", "INFO", "PASS"
	Title       string `json:"title"`
	Description string `json:"description"`
	Path        string `json:"path,omitempty"`
	Method      string `json:"method,omitempty"`
	Remediation string `json:"remediation"`
}

// HeaderAuditResult represents live HTTP security headers evaluation.
type HeaderAuditResult struct {
	TargetURL string            `json:"target_url"`
	Status    int               `json:"status"`
	Headers   map[string]string `json:"headers"`
	Checks    []SecurityFinding `json:"checks"`
}

// FuzzingPresetGroup represents a category of client-side payloads.
type FuzzingPresetGroup struct {
	Category string         `json:"category"`
	Payloads []FuzzPayload  `json:"payloads"`
}

// FuzzPayload represents a single test payload with description.
type FuzzPayload struct {
	Name        string `json:"name"`
	Payload     string `json:"payload"`
	Description string `json:"description"`
	Risk        string `json:"risk"`
}

// Secret detection regular expressions for static analysis
var (
	reAWSKey       = regexp.MustCompile(`(?i)(AKIA|ASIA)[0-9A-Z]{16}`)
	reJWT          = regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`)
	reSlackToken   = regexp.MustCompile(`xox[baprs]-[0-9a-zA-Z]{10,48}`)
	reGitHubToken  = regexp.MustCompile(`(ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36}`)
	rePrivateKey   = regexp.MustCompile(`-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----`)
)

// AnalyzeSpecSecurity performs in-memory static security analysis of an OpenAPI spec.
func AnalyzeSpecSecurity(spec map[string]any) SecurityAuditResult {
	result := SecurityAuditResult{
		Timestamp:      time.Now().UTC(),
		StaticFindings: []SecurityFinding{},
		FuzzingPresets: GetDefaultFuzzingPresets(),
	}

	score := 100
	critCount := 0
	warnCount := 0
	passCount := 0

	rawPaths, _ := spec["paths"].(map[string]any)
	hasGlobalSecurity := false
	if sec, ok := spec["security"].([]any); ok && len(sec) > 0 {
		hasGlobalSecurity = true
	}

	// Check if security schemes are defined
	hasSecDefinitions := false
	if components, ok := spec["components"].(map[string]any); ok {
		if schemes, ok := components["securitySchemes"].(map[string]any); ok && len(schemes) > 0 {
			hasSecDefinitions = true
		}
	} else if defs, ok := spec["securityDefinitions"].(map[string]any); ok && len(defs) > 0 {
		hasSecDefinitions = true
	}

	if !hasSecDefinitions && !hasGlobalSecurity {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "AUTH_NO_SCHEMES",
			Category:    "Authentication",
			Severity:    "CRITICAL",
			Title:       "Missing Security Schemes",
			Description: "No OpenAPI security schemes (Bearer JWT, APIKey, OAuth2) are defined.",
			Remediation: "Add a 'securitySchemes' block under 'components' or 'securityDefinitions'.",
		})
		score -= 20
		critCount++
	} else {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "AUTH_SCHEMES_OK",
			Category:    "Authentication",
			Severity:    "PASS",
			Title:       "Security Schemes Configured",
			Description: "OpenAPI spec defines authentication schemes.",
			Remediation: "Ensure all endpoints reference these schemes.",
		})
		passCount++
	}

	// Inspect each path and operation
	unprotectedMutations := 0
	secretsDetected := 0

	for pathStr, pathItem := range rawPaths {
		pathMap, ok := pathItem.(map[string]any)
		if !ok {
			continue
		}

		for methodKey, opVal := range pathMap {
			method := strings.ToUpper(methodKey)
			if method != "GET" && method != "POST" && method != "PUT" && method != "DELETE" && method != "PATCH" {
				continue
			}

			opMap, ok := opVal.(map[string]any)
			if !ok {
				continue
			}

			// Check authentication on mutating operations
			hasOpSecurity := hasGlobalSecurity
			if sec, ok := opMap["security"].([]any); ok {
				hasOpSecurity = len(sec) > 0
			}

			if (method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH") && !hasOpSecurity {
				unprotectedMutations++
				if unprotectedMutations <= 5 { // Report first 5
					result.StaticFindings = append(result.StaticFindings, SecurityFinding{
						ID:          fmt.Sprintf("AUTH_UNPROTECTED_%s_%s", method, pathStr),
						Category:    "Authentication",
						Severity:    "WARNING",
						Title:       "Unprotected Mutating Endpoint",
						Description: fmt.Sprintf("Operation %s %s does not specify security requirements.", method, pathStr),
						Path:        pathStr,
						Method:      method,
						Remediation: "Attach appropriate security requirement or bearer auth to this operation.",
					})
					score -= 5
					warnCount++
				}
			}

			// Scan examples and descriptions for hardcoded secrets
			opJSON, _ := json.Marshal(opMap)
			opStr := string(opJSON)

			if reAWSKey.MatchString(opStr) {
				secretsDetected++
				result.StaticFindings = append(result.StaticFindings, SecurityFinding{
					ID:          fmt.Sprintf("SECRET_AWS_%s_%s", method, pathStr),
					Category:    "Data Exposure",
					Severity:    "CRITICAL",
					Title:       "Potential AWS Key in Spec Example",
					Description: fmt.Sprintf("Found pattern matching AWS Access Key in %s %s.", method, pathStr),
					Path:        pathStr,
					Method:      method,
					Remediation: "Remove hardcoded credentials from documentation examples.",
				})
				score -= 15
				critCount++
			}
			if rePrivateKey.MatchString(opStr) {
				secretsDetected++
				result.StaticFindings = append(result.StaticFindings, SecurityFinding{
					ID:          fmt.Sprintf("SECRET_PKEY_%s_%s", method, pathStr),
					Category:    "Data Exposure",
					Severity:    "CRITICAL",
					Title:       "Private Key Pattern in Spec",
					Description: fmt.Sprintf("Found Private Key PEM header in %s %s.", method, pathStr),
					Path:        pathStr,
					Method:      method,
					Remediation: "Never include private keys in documentation.",
				})
				score -= 25
				critCount++
			}
			if reJWT.MatchString(opStr) {
				result.StaticFindings = append(result.StaticFindings, SecurityFinding{
					ID:          fmt.Sprintf("SECRET_JWT_%s_%s", method, pathStr),
					Category:    "Data Exposure",
					Severity:    "WARNING",
					Title:       "Hardcoded JWT Example",
					Description: fmt.Sprintf("Found JWT token string in %s %s example.", method, pathStr),
					Path:        pathStr,
					Method:      method,
					Remediation: "Use placeholder tokens ('Bearer <token>') in documentation.",
				})
				score -= 3
				warnCount++
			}
		}
	}

	if unprotectedMutations == 0 {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "AUTH_MUTATIONS_OK",
			Category:    "Authentication",
			Severity:    "PASS",
			Title:       "All Mutating Endpoints Protected",
			Description: "All POST/PUT/DELETE/PATCH operations specify authorization requirements.",
			Remediation: "Maintain continuous authorization coverage.",
		})
		passCount++
	}

	if secretsDetected == 0 {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "SECRETS_NONE_FOUND",
			Category:    "Data Exposure",
			Severity:    "PASS",
			Title:       "No Hardcoded Credentials Found",
			Description: "Spec examples do not contain identifiable API keys or private keys.",
			Remediation: "Continue using dummy/redacted values in examples.",
		})
		passCount++
	}

	if score < 0 {
		score = 0
	}
	result.Score = score
	result.Grade = computeGrade(score)
	result.CriticalCount = critCount
	result.WarningCount = warnCount
	result.PassCount = passCount
	result.TotalIssues = critCount + warnCount

	return result
}

// AuditLiveHeaders executes an options/head/get request against a configured environment URL to verify security headers.
func AuditLiveHeaders(ctx context.Context, client *http.Client, targetURL string) (*HeaderAuditResult, error) {
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodOptions, targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed creating request: %w", err)
	}
	req.Header.Set("User-Agent", "go-apidocs-security-audit/1.0")

	resp, err := client.Do(req)
	if err != nil {
		// Try GET fallback
		req, _ = http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		resp, err = client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed reaching target server: %w", err)
		}
	}
	defer resp.Body.Close()

	headersMap := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headersMap[k] = strings.Join(v, ", ")
		}
	}

	audit := &HeaderAuditResult{
		TargetURL: targetURL,
		Status:    resp.StatusCode,
		Headers:   headersMap,
		Checks:    []SecurityFinding{},
	}

	// 1. Content-Security-Policy
	if csp := resp.Header.Get("Content-Security-Policy"); csp != "" {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CSP_OK",
			Category:    "Security Headers",
			Severity:    "PASS",
			Title:       "Content-Security-Policy Present",
			Description: fmt.Sprintf("CSP configured: %s", truncate(csp, 60)),
			Remediation: "Review directives periodically.",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CSP_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing Content-Security-Policy",
			Description: "No Content-Security-Policy header returned.",
			Remediation: "Set 'Content-Security-Policy' to mitigate XSS and injection risks.",
		})
	}

	// 2. X-Content-Type-Options: nosniff
	if cto := resp.Header.Get("X-Content-Type-Options"); strings.EqualFold(cto, "nosniff") {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CTO_OK",
			Category:    "Security Headers",
			Severity:    "PASS",
			Title:       "MIME Sniffing Protection Enabled",
			Description: "X-Content-Type-Options: nosniff is set.",
			Remediation: "Keep this header enabled.",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CTO_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing X-Content-Type-Options",
			Description: "Header 'X-Content-Type-Options: nosniff' not detected.",
			Remediation: "Add 'X-Content-Type-Options: nosniff' to prevent MIME confusion attacks.",
		})
	}

	// 3. X-Frame-Options
	if xfo := resp.Header.Get("X-Frame-Options"); xfo != "" {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_XFO_OK",
			Category:    "Security Headers",
			Severity:    "PASS",
			Title:       "Clickjacking Protection Configured",
			Description: fmt.Sprintf("X-Frame-Options set to: %s", xfo),
			Remediation: "Ensure frame ancestors align with your application needs.",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_XFO_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing X-Frame-Options",
			Description: "No X-Frame-Options header present to prevent framing/clickjacking.",
			Remediation: "Set 'X-Frame-Options: DENY' or 'SAMEORIGIN'.",
		})
	}

	// 4. Strict-Transport-Security (HSTS)
	if hsts := resp.Header.Get("Strict-Transport-Security"); hsts != "" {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_HSTS_OK",
			Category:    "Security Headers",
			Severity:    "PASS",
			Title:       "HSTS Enabled",
			Description: "Strict-Transport-Security is enforced.",
			Remediation: "Maintain max-age >= 31536000 with includeSubDomains.",
		})
	} else if strings.HasPrefix(targetURL, "https://") {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_HSTS_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing Strict-Transport-Security",
			Description: "HTTPS endpoint does not return Strict-Transport-Security header.",
			Remediation: "Enable HSTS on HTTPS endpoints.",
		})
	}

	// 5. CORS Check
	cors := resp.Header.Get("Access-Control-Allow-Origin")
	if cors == "*" && resp.Header.Get("Access-Control-Allow-Credentials") == "true" {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "CORS_WILDCARD_CREDENTIALS",
			Category:    "CORS Misconfiguration",
			Severity:    "CRITICAL",
			Title:       "Insecure CORS: Wildcard with Credentials",
			Description: "Access-Control-Allow-Origin: * combined with credentials allows data leakage.",
			Remediation: "Echo explicit trusted origin instead of wildcard.",
		})
	}

	return audit, nil
}

func computeGrade(score int) string {
	switch {
	case score >= 95:
		return "A+"
	case score >= 90:
		return "A"
	case score >= 80:
		return "B"
	case score >= 70:
		return "C"
	case score >= 60:
		return "D"
	default:
		return "F"
	}
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// GetDefaultFuzzingPresets returns client-side test payloads for sandbox copy/testing.
func GetDefaultFuzzingPresets() []FuzzingPresetGroup {
	return []FuzzingPresetGroup{
		{
			Category: "SQL Injection (SQLi)",
			Payloads: []FuzzPayload{
				{
					Name:        "Classic OR 1=1",
					Payload:     "' OR 1=1 --",
					Description: "Tests for unescaped SQL boolean tautology bypass.",
					Risk:        "HIGH",
				},
				{
					Name:        "Stacked Query Injection",
					Payload:     "1; SELECT pg_sleep(5); --",
					Description: "Tests for stacked query execution or sleep delay.",
					Risk:        "CRITICAL",
				},
				{
					Name:        "UNION SELECT Probe",
					Payload:     "' UNION SELECT NULL, NULL, NULL --",
					Description: "Tests for UNION-based data extraction.",
					Risk:        "HIGH",
				},
			},
		},
		{
			Category: "Cross-Site Scripting (XSS)",
			Payloads: []FuzzPayload{
				{
					Name:        "Basic Script Tag",
					Payload:     "<script>alert('XSS')</script>",
					Description: "Tests if HTML response unescaped tags render in browser.",
					Risk:        "MEDIUM",
				},
				{
					Name:        "Image Error Handler",
					Payload:     `<img src=x onerror="alert(1)">`,
					Description: "Tests for event handler execution without script tags.",
					Risk:        "MEDIUM",
				},
				{
					Name:        "SVG Vector",
					Payload:     `<svg/onload=alert(1)>`,
					Description: "Tests for SVG-based vector execution.",
					Risk:        "MEDIUM",
				},
			},
		},
		{
			Category: "Boundary & Type Fuzzing",
			Payloads: []FuzzPayload{
				{
					Name:        "Integer Overflow",
					Payload:     "9223372036854775807",
					Description: "Tests MaxInt64 overflow handling.",
					Risk:        "LOW",
				},
				{
					Name:        "Negative Number",
					Payload:     "-1",
					Description: "Tests negative number validation for counts/amounts.",
					Risk:        "LOW",
				},
				{
					Name:        "Null & Special Tokens",
					Payload:     "null",
					Description: "Tests for null pointer dereference.",
					Risk:        "LOW",
				},
				{
					Name:        "Path Traversal Probe",
					Payload:     "../../../../etc/passwd",
					Description: "Tests file path parameters for directory escape.",
					Risk:        "HIGH",
				},
			},
		},
	}
}
