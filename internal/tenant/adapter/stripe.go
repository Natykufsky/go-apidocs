package adapter

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	"github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

// StripeBillingAdapter implements port.BillingWebhookHandler for Stripe webhooks.
type StripeBillingAdapter struct {
	webhookSecret string
}

// NewStripeBillingAdapter creates a new Stripe webhook processor.
func NewStripeBillingAdapter(webhookSecret string) *StripeBillingAdapter {
	return &StripeBillingAdapter{webhookSecret: webhookSecret}
}

// VerifySignature validates Stripe v1 HMAC-SHA256 signature headers.
func (s *StripeBillingAdapter) VerifySignature(payload []byte, header string) bool {
	if s.webhookSecret == "" {
		return true // Permissive if not set in dev
	}

	parts := strings.Split(header, ",")
	var timestamp string
	var signatures []string

	for _, part := range parts {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) == 2 {
			if kv[0] == "t" {
				timestamp = kv[1]
			} else if kv[0] == "v1" {
				signatures = append(signatures, kv[1])
			}
		}
	}

	if timestamp == "" || len(signatures) == 0 {
		return false
	}

	// Check timestamp tolerance (within 10 minutes)
	if ts, err := strconv.ParseInt(timestamp, 10, 64); err == nil {
		eventTime := time.Unix(ts, 0)
		if time.Since(eventTime).Abs() > 10*time.Minute {
			return false
		}
	}

	signedPayload := timestamp + "." + string(payload)
	mac := hmac.New(sha256.New, []byte(s.webhookSecret))
	mac.Write([]byte(signedPayload))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	for _, sig := range signatures {
		if hmac.Equal([]byte(sig), []byte(expectedSig)) {
			return true
		}
	}

	return false
}

// ProcessWebhook parses Stripe events into a normalized port.WebhookEvent.
func (s *StripeBillingAdapter) ProcessWebhook(ctx context.Context, payload []byte, signature string) (*port.WebhookEvent, error) {
	if !s.VerifySignature(payload, signature) {
		return nil, fmt.Errorf("invalid stripe webhook signature")
	}

	var rawEvent struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Data struct {
			Object struct {
				ID       string            `json:"id"`
				Customer string            `json:"customer"`
				Status   string            `json:"status"`
				Metadata map[string]string `json:"metadata"`
				Plan     struct {
					ID string `json:"id"`
				} `json:"plan"`
			} `json:"object"`
		} `json:"data"`
	}

	if err := json.Unmarshal(payload, &rawEvent); err != nil {
		return nil, fmt.Errorf("failed to decode stripe webhook: %w", err)
	}

	tenantID := domain.TenantID(rawEvent.Data.Object.Metadata["tenant_id"])
	if tenantID == "" {
		tenantID = domain.TenantID(rawEvent.Data.Object.Customer)
	}

	plan := domain.PlanTier(rawEvent.Data.Object.Metadata["plan"])
	if plan == "" {
		plan = domain.PlanTeam
	}

	status := rawEvent.Data.Object.Status
	if rawEvent.Type == "customer.subscription.deleted" {
		status = "canceled"
		plan = domain.PlanCommunity
	}

	return &port.WebhookEvent{
		Provider:       "stripe",
		EventID:        rawEvent.ID,
		TenantID:       tenantID,
		Plan:           plan,
		Status:         status,
		SubscriptionID: rawEvent.Data.Object.ID,
		CustomerID:     rawEvent.Data.Object.Customer,
		RawPayload:     payload,
	}, nil
}
