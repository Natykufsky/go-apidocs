package saas

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

type contextKey string

const TenantContextKey contextKey = "apidocs_saas_tenant"

// Service provides tenant lifecycle and SaaS quota checks.
type Service struct {
	repo  tenantPort.TenantRepository
	dedup EventDedup
}

// NewService instantiates a SaaS service. An optional EventDedup can be set via
// SetEventDedup for idempotent billing-webhook processing (recommended in production).
func NewService(repo tenantPort.TenantRepository) *Service {
	return &Service{repo: repo}
}

// SetEventDedup enables idempotent billing-webhook processing.
func (s *Service) SetEventDedup(dedup EventDedup) {
	s.dedup = dedup
}

// RegisterTenantRequest represents onboarding input payload.
type RegisterTenantRequest struct {
	ID         string          `json:"id"`
	Subdomain  string          `json:"subdomain"`
	Name       string          `json:"name"`
	AdminEmail string          `json:"admin_email"`
	Plan       domain.PlanTier `json:"plan"`
}

// RegisterTenant provisions a new SaaS tenant with default plan limits and API keys.
func (s *Service) RegisterTenant(ctx context.Context, req RegisterTenantRequest) (*tenantDomain.Tenant, error) {
	tenantID := strings.TrimSpace(req.ID)
	if tenantID == "" {
		tenantID = strings.TrimSpace(req.Subdomain)
	}
	if tenantID == "" {
		return nil, fmt.Errorf("tenant ID or subdomain is required")
	}
	if strings.TrimSpace(req.Name) == "" {
		req.Name = tenantID
	}
	if req.Plan == "" {
		req.Plan = domain.PlanCommunity
	}

	// Check for existing ID
	if existing, _ := s.repo.GetByID(ctx, domain.TenantID(tenantID)); existing != nil {
		return nil, fmt.Errorf("tenant with ID '%s' already exists", tenantID)
	}

	// Generate secure API Key
	rawKey := make([]byte, 16)
	_, _ = rand.Read(rawKey)
	apiKey := fmt.Sprintf("ak_live_%s", hex.EncodeToString(rawKey))

	tenant := &tenantDomain.Tenant{
		ID:        domain.TenantID(strings.ToLower(tenantID)),
		Name:      req.Name,
		Plan:      req.Plan,
		APIKey:    apiKey,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Limits:    tenantDomain.DefaultLimitsForPlan(req.Plan),
	}

	if err := s.repo.Save(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to save tenant: %w", err)
	}

	return tenant, nil
}

// GetTenant retrieves a tenant by ID.
func (s *Service) GetTenant(ctx context.Context, id domain.TenantID) (*tenantDomain.Tenant, error) {
	return s.repo.GetByID(ctx, id)
}

// ResolveTenantFromRequest inspects headers, query params, subdomains, and API keys to identify the tenant.
func (s *Service) ResolveTenantFromRequest(r *http.Request) (*tenantDomain.Tenant, error) {
	ctx := r.Context()

	// 1. API Key Auth (Bearer token or X-API-Key header)
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ak_") {
			apiKey = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	if apiKey != "" {
		if tenant, err := s.repo.GetByAPIKey(ctx, apiKey); err == nil && tenant != nil {
			return tenant, nil
		}
	}

	// 2. Explicit Header (e.g., from reverse proxy / API gateway)
	if tenantID := r.Header.Get("X-Tenant-ID"); tenantID != "" {
		if tenant, err := s.repo.GetByID(ctx, domain.TenantID(tenantID)); err == nil && tenant != nil {
			return tenant, nil
		}
	}

	// 3. Subdomain extraction (e.g. acme.apidocs.dev -> acme)
	host := r.Host
	if strings.Contains(host, ":") {
		host = strings.Split(host, ":")[0]
	}
	parts := strings.Split(host, ".")
	if len(parts) >= 3 {
		subdomain := strings.ToLower(parts[0])
		if subdomain != "www" && subdomain != "api" && subdomain != "app" {
			if tenant, err := s.repo.GetByID(ctx, domain.TenantID(subdomain)); err == nil && tenant != nil {
				return tenant, nil
			}
		}
	}

	// 4. Default fallback tenant
	return s.repo.GetByID(ctx, "default")
}

// UpdateThemeRequest represents custom branding payload.
type UpdateThemeRequest struct {
	PrimaryColor string `json:"primary_color"`
	AccentColor  string `json:"accent_color"`
	LogoURL      string `json:"logo_url"`
	CustomCSS    string `json:"custom_css"`
	DarkMode     bool   `json:"dark_mode"`
}

// UpdateTenantTheme updates the visual theme for a tenant.
func (s *Service) UpdateTenantTheme(ctx context.Context, tenantID domain.TenantID, req UpdateThemeRequest) (*tenantDomain.Tenant, error) {
	tenant, err := s.repo.GetByID(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if req.PrimaryColor != "" {
		tenant.Theme.PrimaryColor = req.PrimaryColor
	}
	if req.AccentColor != "" {
		tenant.Theme.AccentColor = req.AccentColor
	}
	tenant.Theme.LogoURL = req.LogoURL
	tenant.Theme.CustomCSS = req.CustomCSS
	tenant.Theme.DarkMode = req.DarkMode
	tenant.UpdatedAt = time.Now().UTC()

	if err := s.repo.Save(ctx, tenant); err != nil {
		return nil, fmt.Errorf("failed to update tenant theme: %w", err)
	}
	return tenant, nil
}

// EventDedup remembers processed billing event IDs so Stripe retries are
// idempotent. Interface kept at the usecase boundary so a persistent (DB)
// implementation can replace the in-memory one without touching handlers.
type EventDedup interface {
	// Seen reports whether the event ID was already processed.
	Seen(ctx context.Context, eventID string) (bool, error)
	// Mark records an event ID as processed.
	Mark(ctx context.Context, eventID string) error
}

// InMemoryEventDedup is a bounded, thread-safe EventDedup with TTL expiry.
type InMemoryEventDedup struct {
	mu      sync.Mutex
	entries map[string]time.Time
	ttl     time.Duration
	maxSize int
}

// NewInMemoryEventDedup creates a dedup store; entries expire after ttl and the
// store evicts oldest entries once maxSize is reached.
func NewInMemoryEventDedup(ttl time.Duration, maxSize int) *InMemoryEventDedup {
	if ttl <= 0 {
		ttl = 24 * time.Hour // Stripe retries within 72h max; 24h is a safe window
	}
	if maxSize <= 0 {
		maxSize = 10000
	}
	return &InMemoryEventDedup{
		entries: make(map[string]time.Time),
		ttl:     ttl,
		maxSize: maxSize,
	}
}

func (d *InMemoryEventDedup) Seen(_ context.Context, eventID string) (bool, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.evictExpiredLocked()
	_, exists := d.entries[eventID]
	return exists, nil
}

func (d *InMemoryEventDedup) Mark(_ context.Context, eventID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.evictExpiredLocked()
	if len(d.entries) >= d.maxSize {
		// Evict the oldest entry to keep memory bounded.
		var oldestID string
		var oldest time.Time
		for id, ts := range d.entries {
			if oldestID == "" || ts.Before(oldest) {
				oldestID, oldest = id, ts
			}
		}
		if oldestID != "" {
			delete(d.entries, oldestID)
		}
	}
	d.entries[eventID] = time.Now()
	return nil
}

func (d *InMemoryEventDedup) evictExpiredLocked() {
	cutoff := time.Now().Add(-d.ttl)
	for id, ts := range d.entries {
		if ts.Before(cutoff) {
			delete(d.entries, id)
		}
	}
}

// ApplyBillingEvent updates tenant plan and status from a processed billing webhook.
// Duplicate event IDs (Stripe retries) are detected and skipped, making the
// handler idempotent.
func (s *Service) ApplyBillingEvent(ctx context.Context, event *tenantPort.WebhookEvent) error {
	if event == nil || event.TenantID == "" {
		return fmt.Errorf("invalid billing event: missing tenant ID")
	}

	// Idempotency: skip events already applied (Stripe retries the same event ID).
	if s.dedup != nil && event.EventID != "" {
		seen, err := s.dedup.Seen(ctx, event.EventID)
		if err != nil {
			return fmt.Errorf("billing dedup check failed: %w", err)
		}
		if seen {
			return nil
		}
	}

	tenant, err := s.repo.GetByID(ctx, event.TenantID)
	if err != nil {
		return fmt.Errorf("tenant lookup failed: %w", err)
	}

	tenant.Plan = event.Plan
	tenant.Status = event.Status
	tenant.BillingID = event.CustomerID
	tenant.Limits = tenantDomain.DefaultLimitsForPlan(event.Plan)
	tenant.UpdatedAt = time.Now().UTC()

	if err := s.repo.Save(ctx, tenant); err != nil {
		return err
	}

	if s.dedup != nil && event.EventID != "" {
		if err := s.dedup.Mark(ctx, event.EventID); err != nil {
			return fmt.Errorf("billing dedup mark failed: %w", err)
		}
	}
	return nil
}

// Middleware returns an HTTP middleware that extracts and sets Tenant in request context.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant, err := s.ResolveTenantFromRequest(r)
		if err != nil || tenant == nil {
			http.Error(w, `{"error":"unauthorized or tenant not found"}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), TenantContextKey, tenant)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
