package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/v2/internal/qa/domain"
)

// SecurityAuditorPort defines the port for analyzing OpenAPI specs and security posture.
type SecurityAuditorPort interface {
	AuditSpec(ctx context.Context, specMap map[string]any) (*domain.SecurityAudit, error)
}
