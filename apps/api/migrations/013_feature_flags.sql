-- Feature flags: global dashboard feature-visibility rows. The owner account
-- (OWNER_EMAILS) toggles which features every other account sees from the
-- Settings -> Features tab; their own account always bypasses the gate.
-- Missing rows mean "visible", so this table starts empty and only grows when
-- someone toggles or renames a feature.
--
-- app/core/database.py provisions the table via Base.metadata.create_all on
-- startup; this file keeps manually-migrated environments in sync.
-- Idempotent: safe to re-run in any environment.

CREATE TABLE IF NOT EXISTS feature_flags (
    id VARCHAR(36) PRIMARY KEY,
    key VARCHAR(64) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT TRUE,
    label_override VARCHAR(80),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_feature_flags_key
    ON feature_flags (key);
