package saas

import (
	"context"
	"sync"
	"testing"
	"time"

	domain "github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantMemory "github.com/Natykufsky/go-apidocs/internal/tenant/adapter/memory"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

func TestInMemoryEventDedup_SeenAndMark(t *testing.T) {
	d := NewInMemoryEventDedup(time.Hour, 100)
	ctx := context.Background()

	if seen, _ := d.Seen(ctx, "evt-1"); seen {
		t.Error("unknown event should not be marked seen")
	}
	if err := d.Mark(ctx, "evt-1"); err != nil {
		t.Fatalf("Mark failed: %v", err)
	}
	if seen, _ := d.Seen(ctx, "evt-1"); !seen {
		t.Error("marked event should be seen")
	}
}

func TestInMemoryEventDedup_TTLExpiry(t *testing.T) {
	d := NewInMemoryEventDedup(time.Hour, 100) // valid ttl, then age entries manually
	ctx := context.Background()
	_ = d.Mark(ctx, "evt-old")
	// Manually age the entry beyond TTL.
	d.mu.Lock()
	d.entries["evt-old"] = time.Now().Add(-2 * time.Hour)
	d.mu.Unlock()

	if seen, _ := d.Seen(ctx, "evt-old"); seen {
		t.Error("expired entry should not be seen")
	}
}

func TestInMemoryEventDedup_BoundedSize(t *testing.T) {
	d := NewInMemoryEventDedup(time.Hour, 3)
	ctx := context.Background()
	for i := 0; i < 10; i++ {
		_ = d.Mark(ctx, string(rune('a'+i)))
	}
	d.mu.Lock()
	n := len(d.entries)
	d.mu.Unlock()
	if n > 3 {
		t.Errorf("dedup store exceeded maxSize: %d entries", n)
	}
}

func TestApplyBillingEvent_Idempotent(t *testing.T) {
	repo := tenantMemory.NewMemoryTenantRepository()
	svc := NewService(repo)
	svc.SetEventDedup(NewInMemoryEventDedup(0, 0))

	// Seed a tenant to receive the billing event.
	_ = repo.Save(context.Background(), &tenantDomain.Tenant{
		ID:   "t-1",
		Name: "Acme",
		Plan: domain.PlanCommunity,
	})

	event := &tenantPort.WebhookEvent{
		Provider:   "stripe",
		EventID:    "evt_123",
		TenantID:   "t-1",
		Plan:       domain.PlanTeam,
		Status:     "active",
		CustomerID: "cus_abc",
	}

	ctx := context.Background()
	// First application: applied.
	if err := svc.ApplyBillingEvent(ctx, event); err != nil {
		t.Fatalf("first ApplyBillingEvent failed: %v", err)
	}
	got, _ := repo.GetByID(ctx, "t-1")
	if got.Plan != domain.PlanTeam {
		t.Errorf("plan = %q, want team after first event", got.Plan)
	}

	// Retry of the same event (Stripe retry): skipped, no state change.
	event.Plan = domain.PlanEnterprise // attacker/retry mutates payload
	if err := svc.ApplyBillingEvent(ctx, event); err != nil {
		t.Fatalf("retried ApplyBillingEvent failed: %v", err)
	}
	got, _ = repo.GetByID(ctx, "t-1")
	if got.Plan != domain.PlanTeam {
		t.Errorf("plan = %q, want team (retry must be ignored)", got.Plan)
	}

	// A genuinely new event applies normally.
	event.EventID = "evt_456"
	if err := svc.ApplyBillingEvent(ctx, event); err != nil {
		t.Fatalf("second distinct ApplyBillingEvent failed: %v", err)
	}
	got, _ = repo.GetByID(ctx, "t-1")
	if got.Plan != domain.PlanEnterprise {
		t.Errorf("plan = %q, want enterprise for new event", got.Plan)
	}
}

func TestApplyBillingEvent_RejectsInvalid(t *testing.T) {
	svc := NewService(tenantMemory.NewMemoryTenantRepository())
	if err := svc.ApplyBillingEvent(context.Background(), nil); err == nil {
		t.Error("nil event should be rejected")
	}
	if err := svc.ApplyBillingEvent(context.Background(), &tenantPort.WebhookEvent{}); err == nil {
		t.Error("event without tenant ID should be rejected")
	}
}

// Compile-time: ensure dedup is concurrency-safe under simultaneous webhooks.
func TestInMemoryEventDedup_Concurrent(t *testing.T) {
	d := NewInMemoryEventDedup(0, 0)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			ctx := context.Background()
			id := "evt"
			_, _ = d.Seen(ctx, id)
			_ = d.Mark(ctx, id)
		}(i)
	}
	wg.Wait()
}
