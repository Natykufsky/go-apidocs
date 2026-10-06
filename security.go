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
	Timestamp      time.Time            `json:"timestamp"`
	Score          int                  `json:"score"` // 0 to 100
	Grade          string               `json:"grade"` // A+, A, B, C, D, F
	TotalIssues    int                  `json:"total_issues"`
	CriticalCount  int                  `json:"critical_count"`
	WarningCount   int                  `json:"warning_count"`
	PassCount      int                  `json:"pass_count"`
	StaticFindings []SecurityFinding    `json:"static_findings"`
	HeaderAudit    *HeaderAuditResult   `json:"header_audit,omitempty"`
	FuzzingPresets []FuzzingPresetGroup `json:"fuzzing_presets"`
	OWASPMatrix    map[string]int       `json:"owasp_matrix,omitempty"` // OWASP category -> count of findings
}

// SecurityFinding represents an identified vulnerability or compliance gap.
type SecurityFinding struct {
	ID          string `json:"id"`
	Category    string `json:"category"` // "Authentication", "Data Exposure", "BOLA/IDOR", "Rate Limiting", "Input Validation", "Security Headers"
	Severity    string `json:"severity"` // "CRITICAL", "WARNING", "INFO", "PASS"
	Title       string `json:"title"`
	Description string `json:"description"`
	Path        string `json:"path,omitempty"`
	Method      string `json:"method,omitempty"`
	Remediation string `json:"remediation"`
	OWASPRef    string `json:"owasp_ref,omitempty"` // e.g. "API1:2023", "API2:2023", "API3:2023"
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
	Category string        `json:"category"`
	Payloads []FuzzPayload `json:"payloads"`
}

// FuzzPayload represents a single test payload with description.
type FuzzPayload struct {
	Name        string `json:"name"`
	Payload     string `json:"payload"`
	Description string `json:"description"`
	Risk        string `json:"risk"`
}

// Secret & sensitive field detection patterns for static analysis
var (
	reAWSKey       = regexp.MustCompile(`(?i)(AKIA|ASIA)[0-9A-Z]{16}`)
	reJWT          = regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`)
	reSlackToken   = regexp.MustCompile(`xox[baprs]-[0-9a-zA-Z]{10,48}`)
	reGitHubToken  = regexp.MustCompile(`(ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36}`)
	rePrivateKey   = regexp.MustCompile(`-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----`)
	reSensitiveKey = regexp.MustCompile(`(?i)(password|secret|api_key|token|auth_token|access_token|private_key|pin|cvv|bvn|ssn)`)
	reIDParam      = regexp.MustCompile(`(?i)\{.*(id|uuid|account|user|entity|tenant|order|invoice).*\}$`)
)

// AnalyzeSpecSecurity performs in-memory static security analysis of an OpenAPI spec.
func AnalyzeSpecSecurity(spec map[string]any) SecurityAuditResult {
	result := SecurityAuditResult{
		Timestamp:      time.Now().UTC(),
		StaticFindings: []SecurityFinding{},
		FuzzingPresets: GetDefaultFuzzingPresets(),
		OWASPMatrix:    make(map[string]int),
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

	// 1. Check if security schemes are defined (OWASP API2: Broken Authentication)
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
			OWASPRef:    "API2:2023",
		})
		result.OWASPMatrix["API2: Broken Authentication"]++
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
			OWASPRef:    "API2:2023",
		})
		passCount++
	}

	// Inspect each path and operation
	unprotectedMutations := 0
	secretsDetected := 0
	bolaIssues := 0
	queryTokenIssues := 0
	sensitiveResponseFields := 0
	missingPaginationIssues := 0

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

			// Check authentication on mutating operations (OWASP API2)
			hasOpSecurity := hasGlobalSecurity
			if sec, ok := opMap["security"].([]any); ok {
				hasOpSecurity = len(sec) > 0
			}

			if (method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH") && !hasOpSecurity {
				unprotectedMutations++
				if unprotectedMutations <= 5 { // Report up to 5
					result.StaticFindings = append(result.StaticFindings, SecurityFinding{
						ID:          fmt.Sprintf("AUTH_UNPROTECTED_%s_%s", method, pathStr),
						Category:    "Authentication",
						Severity:    "WARNING",
						Title:       "Unprotected Mutating Endpoint",
						Description: fmt.Sprintf("Operation %s %s does not specify security requirements.", method, pathStr),
						Path:        pathStr,
						Method:      method,
						Remediation: "Attach appropriate security requirement or bearer auth to this operation.",
						OWASPRef:    "API2:2023",
					})
					result.OWASPMatrix["API2: Broken Authentication"]++
					score -= 4
					warnCount++
				}
			}

			// BOLA / IDOR Detection (OWASP API1: Broken Object Level Authorization)
			// Flag endpoints with direct object identifiers that have no explicit authorization scope
			if reIDParam.MatchString(pathStr) && !hasOpSecurity {
				bolaIssues++
				if bolaIssues <= 5 {
					result.StaticFindings = append(result.StaticFindings, SecurityFinding{
						ID:          fmt.Sprintf("BOLA_UNSCOPED_ID_%s_%s", method, pathStr),
						Category:    "BOLA/IDOR",
						Severity:    "CRITICAL",
						Title:       "Unprotected Object ID Parameter (Potential BOLA)",
						Description: fmt.Sprintf("Endpoint %s %s references a specific entity identifier without authentication requirements.", method, pathStr),
						Path:        pathStr,
						Method:      method,
						Remediation: "Enforce strict tenant/user boundary authorization checks and require bearer credentials.",
						OWASPRef:    "API1:2023",
					})
					result.OWASPMatrix["API1: BOLA/IDOR"]++
					score -= 6
					critCount++
				}
			}

			// Check parameters for Sensitive Tokens in Query (OWASP API2 / API3)
			if params, ok := opMap["parameters"].([]any); ok {
				for _, p := range params {
					paramMap, _ := p.(map[string]any)
					pName, _ := paramMap["name"].(string)
					pIn, _ := paramMap["in"].(string)

					if pIn == "query" && reSensitiveKey.MatchString(pName) {
						queryTokenIssues++
						if queryTokenIssues <= 4 {
							result.StaticFindings = append(result.StaticFindings, SecurityFinding{
								ID:          fmt.Sprintf("PARAM_QUERY_SECRET_%s_%s_%s", method, pathStr, pName),
								Category:    "Authentication",
								Severity:    "WARNING",
								Title:       "Sensitive Credential in URL Query Parameter",
								Description: fmt.Sprintf("Parameter '%s' in %s %s is passed via URL query string, exposing it to server access logs and browser histories.", pName, method, pathStr),
								Path:        pathStr,
								Method:      method,
								Remediation: "Pass sensitive credentials via HTTP headers (e.g. Authorization or X-Api-Key) or in the request body over HTTPS.",
								OWASPRef:    "API2:2023",
							})
							result.OWASPMatrix["API2: Broken Authentication"]++
							score -= 3
							warnCount++
						}
					}
				}
			}

			// Check for Missing Pagination on List Collections (OWASP API4: Unrestricted Resource Consumption)
			if method == "GET" && !strings.Contains(pathStr, "{") {
				hasPagination := false
				if params, ok := opMap["parameters"].([]any); ok {
					for _, p := range params {
						paramMap, _ := p.(map[string]any)
						pName, _ := paramMap["name"].(string)
						lower := strings.ToLower(pName)
						if lower == "limit" || lower == "page" || lower == "pagesize" || lower == "offset" || lower == "cursor" || lower == "size" {
							hasPagination = true
							break
						}
					}
				}
				if !hasPagination {
					missingPaginationIssues++
					if missingPaginationIssues <= 3 {
						result.StaticFindings = append(result.StaticFindings, SecurityFinding{
							ID:          fmt.Sprintf("RES_NO_PAGINATION_%s_%s", method, pathStr),
							Category:    "Rate Limiting",
							Severity:    "INFO",
							Title:       "Collection Endpoint Missing Pagination Parameters",
							Description: fmt.Sprintf("Endpoint %s %s appears to be a collection but does not declare pagination parameters (limit, page, cursor).", method, pathStr),
							Path:        pathStr,
							Method:      method,
							Remediation: "Implement page/limit/cursor parameters to mitigate unbounded memory and DB query consumption.",
							OWASPRef:    "API4:2023",
						})
						result.OWASPMatrix["API4: Resource Consumption"]++
					}
				}
			}

			// Scan examples and descriptions for hardcoded secrets (OWASP API3: Broken Object Property Level Authorization)
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
					OWASPRef:    "API3:2023",
				})
				result.OWASPMatrix["API3: Data Exposure"]++
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
					OWASPRef:    "API3:2023",
				})
				result.OWASPMatrix["API3: Data Exposure"]++
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
					OWASPRef:    "API3:2023",
				})
				result.OWASPMatrix["API3: Data Exposure"]++
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
			OWASPRef:    "API2:2023",
		})
		passCount++
	}

	if bolaIssues == 0 {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "BOLA_CHECKS_OK",
			Category:    "BOLA/IDOR",
			Severity:    "PASS",
			Title:       "No Unprotected Entity ID Paths Found",
			Description: "All object identifier paths specify security requirements.",
			Remediation: "Ensure multi-tenant isolation rules are enforced in handlers.",
			OWASPRef:    "API1:2023",
		})
		passCount++
	}

	if secretsDetected == 0 && sensitiveResponseFields == 0 {
		result.StaticFindings = append(result.StaticFindings, SecurityFinding{
			ID:          "SECRETS_NONE_FOUND",
			Category:    "Data Exposure",
			Severity:    "PASS",
			Title:       "No Hardcoded Credentials Found",
			Description: "Spec examples do not contain identifiable API keys or private keys.",
			Remediation: "Continue using dummy/redacted values in examples.",
			OWASPRef:    "API3:2023",
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

	// 1. Content-Security-Policy (OWASP API8)
	if csp := resp.Header.Get("Content-Security-Policy"); csp != "" {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CSP_OK",
			Category:    "Security Headers",
			Severity:    "PASS",
			Title:       "Content-Security-Policy Present",
			Description: fmt.Sprintf("CSP configured: %s", truncate(csp, 60)),
			Remediation: "Review directives periodically.",
			OWASPRef:    "API8:2023",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CSP_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing Content-Security-Policy",
			Description: "No Content-Security-Policy header returned.",
			Remediation: "Set 'Content-Security-Policy' to mitigate XSS and injection risks.",
			OWASPRef:    "API8:2023",
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
			OWASPRef:    "API8:2023",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_CTO_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing X-Content-Type-Options",
			Description: "Header 'X-Content-Type-Options: nosniff' not detected.",
			Remediation: "Add 'X-Content-Type-Options: nosniff' to prevent MIME confusion attacks.",
			OWASPRef:    "API8:2023",
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
			OWASPRef:    "API8:2023",
		})
	} else {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_XFO_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing X-Frame-Options",
			Description: "No X-Frame-Options header present to prevent framing/clickjacking.",
			Remediation: "Set 'X-Frame-Options: DENY' or 'SAMEORIGIN'.",
			OWASPRef:    "API8:2023",
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
			OWASPRef:    "API8:2023",
		})
	} else if strings.HasPrefix(targetURL, "https://") {
		audit.Checks = append(audit.Checks, SecurityFinding{
			ID:          "HEADER_HSTS_MISSING",
			Category:    "Security Headers",
			Severity:    "WARNING",
			Title:       "Missing Strict-Transport-Security",
			Description: "HTTPS endpoint does not return Strict-Transport-Security header.",
			Remediation: "Enable HSTS on HTTPS endpoints.",
			OWASPRef:    "API8:2023",
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
			OWASPRef:    "API7:2023",
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

// GetDefaultFuzzingPresets returns comprehensive client-side test payloads for developer sandbox testing.
func GetDefaultFuzzingPresets() []FuzzingPresetGroup {
	return []FuzzingPresetGroup{
		{
			Category: "SQL Injection (SQLi)",
			Payloads: []FuzzPayload{
				{
					Name:        "Classic OR 1=1 Tautology",
					Payload:     "' OR '1'='1",
					Description: "Tests for unescaped SQL boolean tautology bypass.",
					Risk:        "HIGH",
				},
				{
					Name:        "Stacked Query Sleep Probe",
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
			Category: "NoSQL & JSON Injection",
			Payloads: []FuzzPayload{
				{
					Name:        "MongoDB Not-Equal Operator",
					Payload:     `{"$ne": null}`,
					Description: "Tests for unescaped NoSQL operator evaluation in JSON body.",
					Risk:        "HIGH",
				},
				{
					Name:        "MongoDB Greater-Than Operator",
					Payload:     `{"$gt": ""}`,
					Description: "Tests for string boundary bypass in NoSQL filters.",
					Risk:        "HIGH",
				},
				{
					Name:        "JavaScript $where Eval Probe",
					Payload:     `{"$where": "sleep(5000)"}`,
					Description: "Tests for unescaped $where clause evaluation.",
					Risk:        "CRITICAL",
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
			Category: "Command & Special Character Injection",
			Payloads: []FuzzPayload{
				{
					Name:        "Pipe Command Delimiter",
					Payload:     "| whoami",
					Description: "Tests for unescaped shell piping in system calls.",
					Risk:        "CRITICAL",
				},
				{
					Name:        "Semicolon Command Chaining",
					Payload:     "; id",
					Description: "Tests for command separation injection.",
					Risk:        "CRITICAL",
				},
				{
					Name:        "Backtick Execution Probe",
					Payload:     "`whoami`",
					Description: "Tests for command interpolation in shell contexts.",
					Risk:        "CRITICAL",
				},
			},
		},
		{
			Category: "Server-Side Request Forgery (SSRF)",
			Payloads: []FuzzPayload{
				{
					Name:        "AWS Cloud Instance Metadata",
					Payload:     "http://169.254.169.254/latest/meta-data/",
					Description: "Tests if URL parameter accesses internal cloud metadata.",
					Risk:        "CRITICAL",
				},
				{
					Name:        "Localhost Loopback Probe",
					Payload:     "http://127.0.0.1:8080/admin",
					Description: "Tests if URL parameter accesses internal loopback services.",
					Risk:        "HIGH",
				},
			},
		},
		{
			Category: "Boundary & Type Fuzzing",
			Payloads: []FuzzPayload{
				{
					Name:        "Integer Overflow (MaxInt64)",
					Payload:     "9223372036854775807",
					Description: "Tests 64-bit integer boundary and numeric overflow handling.",
					Risk:        "LOW",
				},
				{
					Name:        "Negative Number",
					Payload:     "-1",
					Description: "Tests negative number validation for counts, balances, and quantities.",
					Risk:        "LOW",
				},
				{
					Name:        "Null & Special Tokens",
					Payload:     "null",
					Description: "Tests for null pointer dereferences.",
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
