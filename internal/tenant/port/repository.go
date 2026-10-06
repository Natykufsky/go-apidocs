package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
)

// TenantRepository defines the persistence port for SaaS tenants.
type TenantRepository interface {
	GetByID(ctx context.Context, id domain.TenantID) (*tenantDomain.Tenant, error)
	GetByAPIKey(ctx context.Context, apiKey string) (*tenantDomain.Tenant, error)
	Save(ctx context.Context, tenant *tenantDomain.Tenant) error
	RecordAIUsage(ctx context.Context, id domain.TenantID) error
}
