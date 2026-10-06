package memory

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

// MemoryTenantRepository provides an in-memory thread-safe implementation of TenantRepository.
type MemoryTenantRepository struct {
	mu      sync.RWMutex
	tenants map[domain.TenantID]*tenantDomain.Tenant
	byKey   map[string]domain.TenantID
}

// NewMemoryTenantRepository instantiates a new in-memory tenant repository with optional seed tenants.
func NewMemoryTenantRepository() *MemoryTenantRepository {
	repo := &MemoryTenantRepository{
		tenants: make(map[domain.TenantID]*tenantDomain.Tenant),
		byKey:   make(map[string]domain.TenantID),
	}

	// Seed default SaaS tenant for local dev / testing
	defaultTenant := &tenantDomain.Tenant{
		ID:        "default",
		Name:      "Demo Organization",
		Plan:      domain.PlanEnterprise,
		APIKey:    "ak_live_default_demo_key",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Limits:    tenantDomain.DefaultLimitsForPlan(domain.PlanEnterprise),
	}
	repo.tenants[defaultTenant.ID] = defaultTenant
	repo.byKey[defaultTenant.APIKey] = defaultTenant.ID

	return repo
}

var _ tenantPort.TenantRepository = (*MemoryTenantRepository)(nil)

func (r *MemoryTenantRepository) GetByID(ctx context.Context, id domain.TenantID) (*tenantDomain.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	t, exists := r.tenants[id]
	if !exists {
		return nil, domain.ErrNotFound
	}
	// Return shallow copy
	copy := *t
	return &copy, nil
}

func (r *MemoryTenantRepository) GetByAPIKey(ctx context.Context, apiKey string) (*tenantDomain.Tenant, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	id, exists := r.byKey[apiKey]
	if !exists {
		return nil, domain.ErrNotFound
	}

	t, exists := r.tenants[id]
	if !exists {
		return nil, domain.ErrNotFound
	}
	copy := *t
	return &copy, nil
}

func (r *MemoryTenantRepository) Save(ctx context.Context, tenant *tenantDomain.Tenant) error {
	if tenant == nil || tenant.ID == "" {
		return fmt.Errorf("invalid tenant payload: missing ID")
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	tenant.UpdatedAt = time.Now().UTC()
	if tenant.CreatedAt.IsZero() {
		tenant.CreatedAt = tenant.UpdatedAt
	}

	copy := *tenant
	r.tenants[tenant.ID] = &copy
	if tenant.APIKey != "" {
		r.byKey[tenant.APIKey] = tenant.ID
	}
	return nil
}

func (r *MemoryTenantRepository) RecordAIUsage(ctx context.Context, id domain.TenantID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	t, exists := r.tenants[id]
	if !exists {
		return domain.ErrNotFound
	}

	if !t.CanGenerateAI() {
		return domain.ErrQuotaExceeded
	}

	t.IncrementAIUsage()
	return nil
}
