package saas

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

type contextKey string

const TenantContextKey contextKey = "apidocs_saas_tenant"

// Service provides tenant lifecycle and SaaS quota checks.
type Service struct {
	repo tenantPort.TenantRepository
}

// NewService instantiates a SaaS service.
func NewService(repo tenantPort.TenantRepository) *Service {
	return &Service{repo: repo}
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

// ApplyBillingEvent updates tenant plan and status from a processed billing webhook.
func (s *Service) ApplyBillingEvent(ctx context.Context, event *tenantPort.WebhookEvent) error {
	if event == nil || event.TenantID == "" {
		return fmt.Errorf("invalid billing event: missing tenant ID")
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

	return s.repo.Save(ctx, tenant)
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

