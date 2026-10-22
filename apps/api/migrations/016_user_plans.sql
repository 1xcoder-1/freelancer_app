-- Plan state this API enforces. Clerk Billing runs the payment; user_plans is
-- the local mirror written by the Clerk webhook (POST /api/v1/billing/webhook)
-- and reconciled by the web BFF on every plan read (PUT /api/v1/billing/plan).
-- plan_usage holds the per-calendar-month meters for sold usage (proposals,
-- Book AI questions), which must keep counting after an item is deleted.
--
-- The limits themselves are NOT stored here — they live in
-- apps/api/config/pricing.json and are read through app/core/plans.py, so the
-- marketing page, the dashboard meters and this enforcement share one source.
--
-- app/core/database.py provisions the tables via Base.metadata.create_all on
-- startup; this file keeps manually-migrated environments in sync.
-- Idempotent: safe to re-run in any environment.

CREATE TABLE IF NOT EXISTS user_plans (
    id VARCHAR(36) PRIMARY KEY,
    clerk_id VARCHAR(128) NOT NULL,
    tier VARCHAR(16) NOT NULL DEFAULT 'free',
    status VARCHAR(32),
    source VARCHAR(24) NOT NULL DEFAULT 'sync',
    plan_name VARCHAR(80),
    amount_cents INTEGER,
    currency VARCHAR(10),
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_plans_clerk_id
    ON user_plans (clerk_id);

CREATE TABLE IF NOT EXISTS plan_usage (
    id VARCHAR(36) PRIMARY KEY,
    clerk_id VARCHAR(128) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    period VARCHAR(7) NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plan_usage_clerk_id
    ON plan_usage (clerk_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_usage_clerk_kind_period
    ON plan_usage (clerk_id, kind, period);
