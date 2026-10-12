-- Link pages (Linktree-style public profile): one page per workspace with a
-- public slug, an ordered list of link buttons, and an append-only event
-- stream (views/clicks) that powers the stats endpoint and the lifetime
-- counters on link_pages/link_items.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

CREATE TABLE IF NOT EXISTS link_pages (
    id VARCHAR(36) PRIMARY KEY,
    -- UNIQUE: one link page per workspace.
    workspace_id VARCHAR(36) NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    -- Lowercase handle (alnum + hyphen/dot, 2-64), globally unique because it
    -- addresses the public URL /p/{slug}.
    slug VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    headline VARCHAR(200),
    bio VARCHAR(500),
    avatar_url VARCHAR(500),
    theme VARCHAR(32) NOT NULL DEFAULT 'default',
    template VARCHAR(32) NOT NULL DEFAULT 'classic',
    published BOOLEAN NOT NULL DEFAULT FALSE,
    views_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_link_pages_slug ON link_pages (slug);

CREATE TABLE IF NOT EXISTS link_items (
    id VARCHAR(36) PRIMARY KEY,
    -- Full-replace PUT deletes + reinserts rows, so the cascade is the delete path.
    page_id VARCHAR(36) NOT NULL REFERENCES link_pages(id) ON DELETE CASCADE,
    label VARCHAR(200) NOT NULL,
    url VARCHAR(500) NOT NULL,
    icon VARCHAR(40),
    description VARCHAR(300),
    sort_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_link_items_page_id ON link_items (page_id);

CREATE TABLE IF NOT EXISTS link_events (
    id VARCHAR(36) PRIMARY KEY,
    page_id VARCHAR(36) NOT NULL REFERENCES link_pages(id) ON DELETE CASCADE,
    -- NULL = page view. SET NULL keeps the analytics history when an item is
    -- replaced or deleted; the stats breakdown labels those rows.
    item_id VARCHAR(36) REFERENCES link_items(id) ON DELETE SET NULL,
    event_type VARCHAR(16) NOT NULL,
    referrer VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_link_events_page_id ON link_events (page_id);
CREATE INDEX IF NOT EXISTS ix_link_events_item_id ON link_events (item_id);
-- All windowed stats queries range on created_at.
CREATE INDEX IF NOT EXISTS ix_link_events_created_at ON link_events (created_at);
