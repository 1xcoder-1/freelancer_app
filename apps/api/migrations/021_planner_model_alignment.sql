-- 021_planner_model_alignment.sql
-- Root cause this fixes: planner_boards was created by 001 with the legacy
-- shape (user_id / title), but the PlannerBoard model moved to the workspace
-- shape (workspace_id / name / revision / elements / files) without a
-- migration. init_db() only auto-adds missing columns in DEVELOPMENT, so a
-- production database keeps the legacy shape and every planner INSERT fails
-- with UndefinedColumn -> 500 "A secure internal server error occurred".
--
-- This file reconciles all three planner tables to the model shape, idempotent
-- and safe to re-run in any environment:
--   * ADD COLUMN IF NOT EXISTS for every model column (with backfill defaults)
--   * legacy data carried over: title -> name/text, user_id -> owner workspace
--   * orphan rows (no resolvable workspace) are deleted — the app can never
--     address them (the tenant WHERE clause would 404), so nothing readable is lost
--   * nullability tightened to the model where it drifted
--   * legacy-only columns (kanban-era title/description/column_id/order_index/
--     labels) dropped AFTER backfill — the current model cannot read them
--   * due_date converted from the legacy TIMESTAMPTZ to DATE when needed
--   * all model indexes + the daily-snapshot unique constraint ensured

-- ---------------------------------------------------------------------------
-- 1) planner_boards — model columns
-- ---------------------------------------------------------------------------
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS elements JSON NOT NULL DEFAULT '[]';
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS files JSON NOT NULL DEFAULT '{}';
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

-- Legacy backfill: title -> name. Guarded on the legacy column existing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_boards' AND column_name = 'title'
  ) THEN
    UPDATE planner_boards SET name = title WHERE name IS NULL;
  END IF;
  UPDATE planner_boards SET name = 'Untitled board' WHERE name IS NULL;
END $$;

-- Legacy backfill: user_id -> the user's owner workspace.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_boards' AND column_name = 'user_id'
  ) THEN
    UPDATE planner_boards b
    SET workspace_id = m.workspace_id
    FROM memberships m
    WHERE m.user_id = b.user_id
      AND b.workspace_id IS NULL;
  END IF;
END $$;

-- Orphan legacy boards (owner with no workspace) are unreachable by the app.
DELETE FROM planner_boards WHERE workspace_id IS NULL;

-- Nullability drift repair (dev auto-sync adds columns as nullable).
UPDATE planner_boards SET is_public = FALSE WHERE is_public IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_boards' AND column_name = 'workspace_id' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_boards ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_boards' AND column_name = 'name' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_boards ALTER COLUMN name SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_boards' AND column_name = 'is_public' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_boards ALTER COLUMN is_public SET NOT NULL;
  END IF;
END $$;

-- Legacy-only columns, dropped after the backfill above.
ALTER TABLE planner_boards DROP COLUMN IF EXISTS user_id;
ALTER TABLE planner_boards DROP COLUMN IF EXISTS title;

-- ---------------------------------------------------------------------------
-- 2) planner_todos — model columns
-- ---------------------------------------------------------------------------
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(36);
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS text VARCHAR(500);
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS is_done BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20);
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS "date" DATE;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS start_minute INTEGER;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

-- Legacy backfill: title -> text (legacy title was unbounded; cap at 500).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_todos' AND column_name = 'title'
  ) THEN
    UPDATE planner_todos SET text = left(title, 500) WHERE text IS NULL;
  END IF;
  UPDATE planner_todos SET text = '(untitled)' WHERE text IS NULL;
END $$;

-- Legacy due_date was TIMESTAMPTZ; the model (and every query) wants DATE.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_todos' AND column_name = 'due_date'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE planner_todos ALTER COLUMN due_date TYPE DATE USING due_date::date;
  END IF;
END $$;

-- Denormalised workspace: every todo inherits its board's workspace.
UPDATE planner_todos t
SET workspace_id = b.workspace_id
FROM planner_boards b
WHERE t.board_id = b.id
  AND t.workspace_id IS NULL;

-- Orphan todos (board gone, or legacy rows with no resolvable workspace).
DELETE FROM planner_todos WHERE workspace_id IS NULL;
DELETE FROM planner_todos WHERE board_id IS NULL;

UPDATE planner_todos SET priority = 'medium' WHERE priority IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_todos' AND column_name = 'workspace_id' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_todos ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_todos' AND column_name = 'text' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_todos ALTER COLUMN text SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_todos' AND column_name = 'board_id' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_todos ALTER COLUMN board_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planner_todos' AND column_name = 'priority' AND is_nullable = 'YES') THEN
    ALTER TABLE planner_todos ALTER COLUMN priority SET NOT NULL;
  END IF;
END $$;

-- Legacy-only columns, dropped after the backfill above.
ALTER TABLE planner_todos DROP COLUMN IF EXISTS title;
ALTER TABLE planner_todos DROP COLUMN IF EXISTS description;
ALTER TABLE planner_todos DROP COLUMN IF EXISTS column_id;
ALTER TABLE planner_todos DROP COLUMN IF EXISTS order_index;
ALTER TABLE planner_todos DROP COLUMN IF EXISTS labels;

-- ---------------------------------------------------------------------------
-- 3) planner_snapshots — create_all makes missing tables even in production,
--    but keep the explicit idempotent DDL so this file alone is complete.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planner_snapshots (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    board_id VARCHAR(36) NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    captured_on VARCHAR(10) NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    elements JSON NOT NULL DEFAULT '[]',
    files JSON NOT NULL DEFAULT '{}',
    CONSTRAINT uq_planner_snapshot_board_day UNIQUE (board_id, captured_on)
);

-- ---------------------------------------------------------------------------
-- 4) Indexes (all IF NOT EXISTS — mirrors the models' index declarations)
-- ---------------------------------------------------------------------------
-- An early model revision declared workspace_id UNIQUE (one board per
-- workspace); the shipped feature keeps several boards per workspace. The dev
-- schema sync creates missing indexes but never downgrades stale ones, so an
-- old UNIQUE index of this name survives and makes every second board insert
-- fail with a UniqueViolationError. Drop and rebuild as a plain index.
DROP INDEX IF EXISTS ix_planner_boards_workspace_id;
CREATE INDEX IF NOT EXISTS ix_planner_boards_workspace_id ON planner_boards (workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_planner_boards_share_token ON planner_boards (share_token);
CREATE INDEX IF NOT EXISTS ix_planner_todos_board_id ON planner_todos (board_id);
CREATE INDEX IF NOT EXISTS ix_planner_todos_workspace_id ON planner_todos (workspace_id);
CREATE INDEX IF NOT EXISTS ix_planner_todos_due_date ON planner_todos (due_date);
CREATE INDEX IF NOT EXISTS ix_planner_todos_project_id ON planner_todos (project_id);
CREATE INDEX IF NOT EXISTS ix_planner_todos_date ON planner_todos ("date");
CREATE INDEX IF NOT EXISTS ix_planner_snapshots_board_id ON planner_snapshots (board_id);
CREATE INDEX IF NOT EXISTS ix_planner_snapshots_workspace_id ON planner_snapshots (workspace_id);
