-- Expenses sub-pages: the "repeats every month" flag that powers the
-- Subscriptions tab (Netflix of work tools: Figma, hosting, internet...).
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS ix_expenses_is_recurring ON expenses (is_recurring);
