-- Link pages: allow up to 3 public pages per workspace. Each tree gets an
-- owner-facing name for the dashboard cards; the public display_name is
-- unchanged. Slug stays globally unique (it addresses /p/{slug}).
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

-- The old UNIQUE on workspace_id became a constraint named
-- link_pages_workspace_id_key; drop it so a workspace can hold 3 pages.
ALTER TABLE link_pages
    DROP CONSTRAINT IF EXISTS link_pages_workspace_id_key;

ALTER TABLE link_pages
    ADD COLUMN IF NOT EXISTS name VARCHAR(120);

-- Existing single pages keep a sensible card title.
UPDATE link_pages SET name = display_name WHERE name IS NULL OR name = '';

-- The dropped UNIQUE carried the index; replace it with a plain one.
CREATE INDEX IF NOT EXISTS ix_link_pages_workspace_id
    ON link_pages (workspace_id);
