package port

import (
	"context"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
)

// WebhookEvent represents a normalized billing event across providers.
type WebhookEvent struct {
	Provider       string          `json:"provider"` // "stripe", "paddle", "lemonsqueezy"
	EventID        string          `json:"event_id"`
	TenantID       domain.TenantID `json:"tenant_id"`
	Plan           domain.PlanTier `json:"plan"`
	Status         string          `json:"status"` // "active", "past_due", "canceled"
	SubscriptionID string          `json:"subscription_id"`
	CustomerID     string          `json:"customer_id"`
	RawPayload     []byte          `json:"-"`
}

// BillingWebhookHandler processes subscription changes from SaaS payment providers.
type BillingWebhookHandler interface {
	ProcessWebhook(ctx context.Context, payload []byte, signature string) (*WebhookEvent, error)
}
