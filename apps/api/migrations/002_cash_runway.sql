-- Cash-Flow & Financial Runway Dashboard (roadmap 1.1 / 1.2 / 1.4)
-- The freelancer's real money-in-bank lives on the workspace row so every
-- device, the runway gauge and the safe-to-spend math read one figure.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS bank_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS bank_balance_updated_at TIMESTAMP WITHOUT TIME ZONE;
