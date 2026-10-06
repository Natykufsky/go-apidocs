package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/internal/qa/domain"
)

// SecurityAuditorPort defines the port for analyzing OpenAPI specs and security posture.
type SecurityAuditorPort interface {
	AuditSpec(ctx context.Context, specMap map[string]any) (*domain.SecurityAudit, error)
}
