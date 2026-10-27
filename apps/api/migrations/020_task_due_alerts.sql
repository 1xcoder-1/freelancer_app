-- 020_task_due_alerts.sql
-- Task Management due-date alerts: the hourly task.due-alert-scan appends one
-- inbox row per (card, kind, due_date) for open cards due today / overdue.
-- Unlike invoices (which flip 'sent' -> 'overdue' exactly once, their implicit
-- dedupe), a card is pure state — so each task alert carries a dedupe_key and
-- a unique partial index makes repeat scans no-ops.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not. Safe to re-run.

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(150);

-- Partial unique: only keyed (idempotent) producers participate. Classic
-- one-shot producers keep dedupe_key NULL and are untouched by the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe_key
    ON notifications (dedupe_key)
    WHERE dedupe_key IS NOT NULL;
