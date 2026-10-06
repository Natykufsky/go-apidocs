package domain

import "errors"

// Common domain errors across all bounded contexts.
var (
	ErrNotFound       = errors.New("entity not found")
	ErrUnauthorized   = errors.New("unauthorized access")
	ErrForbidden      = errors.New("action forbidden")
	ErrInvalidInput   = errors.New("invalid input data")
	ErrQuotaExceeded  = errors.New("quota exceeded for current plan")
	ErrDuplicateEntry = errors.New("duplicate entry")
)

// TenantID is a strongly typed domain identifier.
type TenantID string

func (t TenantID) String() string {
	return string(t)
}

// WorkspaceID is a strongly typed domain identifier.
type WorkspaceID string

func (w WorkspaceID) String() string {
	return string(w)
}

// ServiceID is a strongly typed domain identifier.
type ServiceID string

func (s ServiceID) String() string {
	return string(s)
}

// PlanTier denotes the SaaS monetization tier.
type PlanTier string

const (
	PlanCommunity  PlanTier = "community"  // Free / Developer tier
	PlanTeam       PlanTier = "team"       // Standard Team SaaS tier
	PlanEnterprise PlanTier = "enterprise" // Self-hosted / Dedicated Cloud
)
