package adapter_test

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantAdapter "github.com/Natykufsky/go-apidocs/internal/tenant/adapter"
)

func TestStripeBillingAdapter_SignatureAndWebhook(t *testing.T) {
	secret := "whsec_test_secret_key"
	adapter := tenantAdapter.NewStripeBillingAdapter(secret)

	payload := []byte(`{
		"id": "evt_test_123",
		"type": "customer.subscription.updated",
		"data": {
			"object": {
				"id": "sub_test_123",
				"customer": "cus_test_123",
				"status": "active",
				"metadata": {
					"tenant_id": "acme-corp",
					"plan": "enterprise"
				}
			}
		}
	}`)

	now := time.Now().Unix()
	signedPayload := fmt.Sprintf("%d.%s", now, string(payload))
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signedPayload))
	sig := hex.EncodeToString(mac.Sum(nil))

	sigHeader := fmt.Sprintf("t=%d,v1=%s", now, sig)

	event, err := adapter.ProcessWebhook(context.Background(), payload, sigHeader)
	if err != nil {
		t.Fatalf("webhook processing failed: %v", err)
	}

	if event.TenantID != "acme-corp" {
		t.Fatalf("expected tenant ID acme-corp, got %s", event.TenantID)
	}
	if event.Plan != domain.PlanEnterprise {
		t.Fatalf("expected plan enterprise, got %s", event.Plan)
	}
	if event.Status != "active" {
		t.Fatalf("expected status active, got %s", event.Status)
	}
}
