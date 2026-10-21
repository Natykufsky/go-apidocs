// Package postgres provides a production-grade PostgreSQL implementation of
// the tenant repository port using pgx v5.
package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Natykufsky/go-apidocs/internal/core/domain"
	tenantDomain "github.com/Natykufsky/go-apidocs/internal/tenant/domain"
	tenantPort "github.com/Natykufsky/go-apidocs/internal/tenant/port"
)

// Compile-time port conformance.
var _ tenantPort.TenantRepository = (*TenantRepository)(nil)

// TenantRepository persists SaaS tenants in PostgreSQL.
type TenantRepository struct {
	pool *pgxpool.Pool
}

// NewTenantRepository connects to Postgres using a DSN (e.g. from
// DATABASE_URL) and applies schema migrations.
func NewTenantRepository(ctx context.Context, dsn string) (*TenantRepository, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("postgres connect failed: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}
	r := &TenantRepository{pool: pool}
	if err := r.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return r, nil
}

// Close releases the connection pool.
func (r *TenantRepository) Close() { r.pool.Close() }

// migrate applies the tenants schema idempotently.
func (r *TenantRepository) migrate(ctx context.Context) error {
	const schema = `
CREATE TABLE IF NOT EXISTS tenants (
	id              TEXT PRIMARY KEY,
	name            TEXT NOT NULL,
	plan            TEXT NOT NULL,
	api_key         TEXT NOT NULL UNIQUE,
	status          TEXT NOT NULL DEFAULT 'active',
	billing_id      TEXT NOT NULL DEFAULT '',
	theme           JSONB NOT NULL DEFAULT '{}'::jsonb,
	limits          JSONB NOT NULL DEFAULT '{}'::jsonb,
	created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_api_key ON tenants (api_key);
`
	_, err := r.pool.Exec(ctx, schema)
	if err != nil {
		return fmt.Errorf("postgres migrate failed: %w", err)
	}
	return nil
}

const tenantColumns = `id, name, plan, api_key, status, billing_id, theme, limits, created_at, updated_at`

func scanTenant(row pgx.Row) (*tenantDomain.Tenant, error) {
	var (
		t          tenantDomain.Tenant
		themeJSON  []byte
		limitsJSON []byte
	)
	if err := row.Scan(&t.ID, &t.Name, &t.Plan, &t.APIKey, &t.Status, &t.BillingID,
		&themeJSON, &limitsJSON, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, domain.ErrNotFound
		}
		return nil, fmt.Errorf("tenant scan failed: %w", err)
	}
	if len(themeJSON) > 0 {
		_ = json.Unmarshal(themeJSON, &t.Theme)
	}
	if len(limitsJSON) > 0 {
		_ = json.Unmarshal(limitsJSON, &t.Limits)
	}
	return &t, nil
}

// GetByID fetches a tenant by primary key.
func (r *TenantRepository) GetByID(ctx context.Context, id domain.TenantID) (*tenantDomain.Tenant, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+tenantColumns+` FROM tenants WHERE id = $1`, string(id))
	return scanTenant(row)
}

// GetByAPIKey fetches a tenant by its unique API key.
func (r *TenantRepository) GetByAPIKey(ctx context.Context, apiKey string) (*tenantDomain.Tenant, error) {
	row := r.pool.QueryRow(ctx,
		`SELECT `+tenantColumns+` FROM tenants WHERE api_key = $1`, apiKey)
	return scanTenant(row)
}

// Save upserts a tenant row (insert or full update).
func (r *TenantRepository) Save(ctx context.Context, t *tenantDomain.Tenant) error {
	if t == nil || t.ID == "" {
		return fmt.Errorf("invalid tenant payload: missing ID")
	}
	themeJSON, err := json.Marshal(t.Theme)
	if err != nil {
		return fmt.Errorf("theme marshal failed: %w", err)
	}
	limitsJSON, err := json.Marshal(t.Limits)
	if err != nil {
		return fmt.Errorf("limits marshal failed: %w", err)
	}

	tag, err := r.pool.Exec(ctx, `
INSERT INTO tenants (id, name, plan, api_key, status, billing_id, theme, limits, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	plan = EXCLUDED.plan,
	api_key = EXCLUDED.api_key,
	status = EXCLUDED.status,
	billing_id = EXCLUDED.billing_id,
	theme = EXCLUDED.theme,
	limits = EXCLUDED.limits,
	updated_at = EXCLUDED.updated_at
`, string(t.ID), t.Name, string(t.Plan), t.APIKey, t.Status, t.BillingID,
		themeJSON, limitsJSON, t.CreatedAt, t.UpdatedAt)
	if err != nil {
		return fmt.Errorf("tenant save failed: %w", err)
	}
	_ = tag
	return nil
}

// RecordAIUsage atomically increments the AI usage counter and enforces the
// plan quota inside a single SQL statement (race-safe under concurrency).
func (r *TenantRepository) RecordAIUsage(ctx context.Context, id domain.TenantID) error {
	tag, err := r.pool.Exec(ctx, `
UPDATE tenants
SET limits = jsonb_set(
	limits,
	'{used_ai_calls}',
	(((limits->>'used_ai_calls')::int + 1)::text)::jsonb
),
updated_at = now()
WHERE id = $1
  AND (limits->>'used_ai_calls')::int < (limits->>'monthly_ai_calls')::int
`, string(id))
	if err != nil {
		return fmt.Errorf("ai usage record failed: %w", err)
	}
	if tag.RowsAffected() == 0 {
		// Either the tenant does not exist or quota is exhausted.
		var exists bool
		_ = r.pool.QueryRow(ctx, `SELECT true FROM tenants WHERE id = $1`, string(id)).Scan(&exists)
		if !exists {
			return domain.ErrNotFound
		}
		return domain.ErrQuotaExceeded
	}
	return nil
}
