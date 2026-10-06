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
}

// TenantLimits defines quota boundaries for SaaS tiers.
type TenantLimits struct {
	MaxWorkspaces  int `json:"max_workspaces"`
	MaxServices    int `json:"max_services"`
	MonthlyAICalls int `json:"monthly_ai_calls"`
	UsedAICalls    int `json:"used_ai_calls"`
}

// CanGenerateAI checks if the tenant has remaining AI test generation quota.
func (t *Tenant) CanGenerateAI() bool {
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
			MaxWorkspaces:  9999,
			MaxServices:    9999,
			MonthlyAICalls: 999999,
		}
	case domain.PlanTeam:
		return TenantLimits{
			MaxWorkspaces:  50,
			MaxServices:    200,
			MonthlyAICalls: 2500,
		}
	default:
		return TenantLimits{
			MaxWorkspaces:  1,
			MaxServices:    5,
			MonthlyAICalls: 50,
		}
	}
}
