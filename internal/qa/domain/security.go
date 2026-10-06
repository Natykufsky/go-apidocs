package domain

import "time"

// Vulnerability denotes an individual detected risk or OWASP issue.
type Vulnerability struct {
	ID          string `json:"id"`
	Severity    string `json:"severity"` // CRITICAL, HIGH, MEDIUM, LOW, INFO
	Title       string `json:"title"`
	Description string `json:"description"`
	Endpoint    string `json:"endpoint,omitempty"`
	Remediation string `json:"remediation"`
}

// SecurityAudit represents the security assessment report.
type SecurityAudit struct {
	Score           int             `json:"score"`
	Grade           string          `json:"grade"`
	Vulnerabilities []Vulnerability `json:"vulnerabilities"`
	AuditedAt       time.Time       `json:"audited_at"`
}
