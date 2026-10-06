package domain

import (
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
)

// Tenant represents an isolated organization or team in the SaaS platform.
type Tenant struct {
	ID        domain.TenantID `json:"id"`
	Name      string          `json:"name"`
	Plan      domain.PlanTier `json:"plan"`
	APIKey    string          `json:"api_key"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Limits    TenantLimits    `json:"limits"`
	Theme     TenantTheme     `json:"theme"`
	Status    string          `json:"status"` // "active", "past_due", "canceled"
	BillingID string          `json:"billing_id,omitempty"`
}

// TenantTheme configures tenant-specific visual branding and custom CSS styling.
type TenantTheme struct {
	PrimaryColor string `json:"primary_color"` // Hex color code e.g. "#10b981"
	AccentColor  string `json:"accent_color"`  // Accent color e.g. "#6366f1"
	LogoURL      string `json:"logo_url"`      // URL to tenant brand logo
	CustomCSS    string `json:"custom_css"`    // Optional custom stylesheet overrides
	DarkMode     bool   `json:"dark_mode"`     // Default dark mode preference
}

// TenantLimits defines quota boundaries and usage meters for SaaS tiers.
type TenantLimits struct {
	MaxWorkspaces      int      `json:"max_workspaces"`
	MaxServices        int      `json:"max_services"`
	MonthlyAICalls     int      `json:"monthly_ai_calls"`
	UsedAICalls        int      `json:"used_ai_calls"`
	MaxStorageMB       int64    `json:"max_storage_mb"`
	UsedStorageMB      int64    `json:"used_storage_mb"`
	RateLimitRPM       int      `json:"rate_limit_rpm"`
	AllowedAIProviders []string `json:"allowed_ai_providers"`
}

// CanGenerateAI checks if the tenant has remaining AI test generation quota.
func (t *Tenant) CanGenerateAI() bool {
	if t.Status == "canceled" || t.Status == "past_due" {
		return false
	}
	if t.Plan == domain.PlanEnterprise {
		return true
	}
	return t.Limits.UsedAICalls < t.Limits.MonthlyAICalls
}

// IncrementAIUsage increments the used AI synthesis quota.
func (t *Tenant) IncrementAIUsage() {
	t.Limits.UsedAICalls++
}

// DefaultLimitsForPlan assigns default quotas for each plan tier.
func DefaultLimitsForPlan(plan domain.PlanTier) TenantLimits {
	switch plan {
	case domain.PlanEnterprise:
		return TenantLimits{
			MaxWorkspaces:      9999,
			MaxServices:        9999,
			MonthlyAICalls:     999999,
			MaxStorageMB:       100000,
			RateLimitRPM:       10000,
			AllowedAIProviders: []string{"nvidia", "openai", "anthropic", "ollama"},
		}
	case domain.PlanTeam:
		return TenantLimits{
			MaxWorkspaces:      50,
			MaxServices:        200,
			MonthlyAICalls:     2500,
			MaxStorageMB:       10000,
			RateLimitRPM:       1000,
			AllowedAIProviders: []string{"nvidia", "openai", "anthropic", "ollama"},
		}
	default:
		return TenantLimits{
			MaxWorkspaces:      1,
			MaxServices:        5,
			MonthlyAICalls:     50,
			MaxStorageMB:       500,
			RateLimitRPM:       120,
			AllowedAIProviders: []string{"nvidia", "ollama"},
		}
	}
}

// DefaultTheme provides modern emerald & slate styling defaults.
func DefaultTheme() TenantTheme {
	return TenantTheme{
		PrimaryColor: "#10b981", // Emerald 500
		AccentColor:  "#6366f1", // Indigo 500
		LogoURL:      "",
		CustomCSS:    "",
		DarkMode:     false,
	}
}
