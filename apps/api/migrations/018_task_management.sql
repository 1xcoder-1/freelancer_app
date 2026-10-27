-- ============================================================================
-- 018_task_management.sql
-- Task Management: Trello-style kanban boards (boards -> lists -> cards ->
-- subtasks/attachments) with a per-board revision counter for cheap
-- multi-tab sync, and an optional project link on cards (SET NULL) so the
-- project detail page can list the work mapped to it.
--
-- In development the app auto-provisions these tables via
-- Base.metadata.create_all on startup; THIS file is the explicit, idempotent
-- path for any environment that does not (Neon / production). Safe to re-run.
-- ============================================================================

-- 1. Boards -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_boards (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    background_url TEXT,
    -- 'unsplash' | 'gradient' — how the client renders background_url.
    background_kind VARCHAR(20),
    -- Bumped on every nested mutation (list/card/subtask/attachment/board edit)
    -- so open tabs poll /head and re-pull the full payload only when it moved.
    revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_task_boards_workspace_id ON task_boards (workspace_id);

-- 2. Lists (columns) ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_lists (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    board_id VARCHAR(36) NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    -- Float positions (max+1 append, midpoint insert) so a reorder never
    -- renumbers the rest of the column.
    position DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_task_lists_board_id ON task_lists (board_id);
CREATE INDEX IF NOT EXISTS ix_task_lists_workspace_id ON task_lists (workspace_id);

-- 3. Cards --------------------------------------------------------------------
-- board_id is denormalised beside list_id (same board always, enforced by the
-- API) so per-board reads and the project-cards join never go through
-- task_lists. workspace_id is the one-column tenant guard used everywhere.
CREATE TABLE IF NOT EXISTS task_cards (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    board_id VARCHAR(36) NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
    list_id VARCHAR(36) NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    -- 'low' | 'medium' | 'high' | 'urgent' (validated in the API), NULL = none.
    priority VARCHAR(20),
    due_date DATE,
    position DOUBLE PRECISION NOT NULL,
    project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL,
    -- Plain list of strings; JSONB on Neon, plain JSON on the SQLite dev DB.
    tags JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS ix_task_cards_board_id ON task_cards (board_id);
CREATE INDEX IF NOT EXISTS ix_task_cards_list_id ON task_cards (list_id);
CREATE INDEX IF NOT EXISTS ix_task_cards_workspace_id ON task_cards (workspace_id);
CREATE INDEX IF NOT EXISTS ix_task_cards_project_id ON task_cards (project_id);
-- Ordered column reads and the per-workspace project rollup.
CREATE INDEX IF NOT EXISTS ix_task_cards_list_position ON task_cards (list_id, position);
CREATE INDEX IF NOT EXISTS ix_task_cards_workspace_project ON task_cards (workspace_id, project_id);

-- 4. Subtasks (checklist lines) -----------------------------------------------
CREATE TABLE IF NOT EXISTS task_subtasks (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    card_id VARCHAR(36) NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    text VARCHAR(500) NOT NULL,
    is_done BOOLEAN NOT NULL DEFAULT FALSE,
    position DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_task_subtasks_card_id ON task_subtasks (card_id);
CREATE INDEX IF NOT EXISTS ix_task_subtasks_workspace_id ON task_subtasks (workspace_id);

-- 5. Attachments (metadata only; binaries live in Cloudinary) ------------------
-- kind='link' stores url; kind='image'/'document' store the Cloudinary public
-- id in file_key (uploaded first via the existing /storage endpoints).
CREATE TABLE IF NOT EXISTS task_attachments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    card_id VARCHAR(36) NOT NULL REFERENCES task_cards(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL,
    url TEXT,
    file_key TEXT,
    file_name VARCHAR(300) NOT NULL,
    content_type VARCHAR(100),
    size_bytes INTEGER
);
CREATE INDEX IF NOT EXISTS ix_task_attachments_card_id ON task_attachments (card_id);
CREATE INDEX IF NOT EXISTS ix_task_attachments_workspace_id ON task_attachments (workspace_id);
