-- Notifications inbox + testimonial collection.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    occurred_at TIMESTAMP NOT NULL DEFAULT now(),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_notifications_workspace_id ON notifications (workspace_id);
CREATE INDEX IF NOT EXISTS ix_notifications_occurred_at ON notifications (occurred_at);
CREATE INDEX IF NOT EXISTS ix_notifications_workspace_read
    ON notifications (workspace_id, is_read, occurred_at);

CREATE TABLE IF NOT EXISTS testimonials (
    id VARCHAR(36) PRIMARY KEY,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    client_id VARCHAR(36) REFERENCES clients(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(255),
    context_label VARCHAR(255),
    quote TEXT,
    rating INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    token VARCHAR(64) NOT NULL UNIQUE,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_testimonials_workspace_id ON testimonials (workspace_id);
CREATE INDEX IF NOT EXISTS ix_testimonials_client_id ON testimonials (client_id);
CREATE INDEX IF NOT EXISTS ix_testimonials_status ON testimonials (status);
CREATE INDEX IF NOT EXISTS ix_testimonials_workspace_status
    ON testimonials (workspace_id, status);
