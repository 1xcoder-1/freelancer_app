-- User profile document: the tabbed profile the owner edits from the settings
-- page (Personal, Professional, Experience, Certifications, Education,
-- Projects). One row per user; the whole document lives in a single JSONB
-- column validated by Pydantic on the way in — same per-user document pattern
-- as report_cards. Identity fields that change in real time (name, avatar,
-- email) stay in Clerk and are NOT stored here.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

CREATE TABLE IF NOT EXISTS user_profiles (
    id VARCHAR(36) PRIMARY KEY,
    -- UNIQUE: one profile document per user.
    user_id VARCHAR(36) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_user_profiles_user_id ON user_profiles (user_id);
