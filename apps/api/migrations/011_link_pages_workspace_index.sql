-- Link pages: the "up to 3 pages per workspace" rule still 500s on the 2nd
-- create, because 008 made workspace_id column-level UNIQUE. Postgres backed
-- that with a UNIQUE *index* named ix_link_pages_workspace_id (not a named
-- constraint), so 010's `DROP CONSTRAINT IF EXISTS link_pages_workspace_id_key`
-- matched nothing and its `CREATE INDEX IF NOT EXISTS` was skipped because an
-- index of that name already existed. Drop the index itself, then rebuild it
-- as a plain lookup index.
--
-- Idempotent: safe to re-run in any environment.

DROP INDEX IF EXISTS ix_link_pages_workspace_id;

CREATE INDEX IF NOT EXISTS ix_link_pages_workspace_id
    ON link_pages (workspace_id);

-- Environments where 010 never ran still have NULL card titles; the model
-- expects a non-null string, so backfill from the public display name.
UPDATE link_pages SET name = display_name WHERE name IS NULL OR name = '';
