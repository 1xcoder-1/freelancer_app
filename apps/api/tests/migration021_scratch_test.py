"""Scratch-database test for migration 021: seeds the LEGACY (001) planner
shape, runs the migration, verifies reconciliation. Run once, then cleanup."""
import asyncio
import re
import sys

import asyncpg
from dotenv import load_dotenv
import os

load_dotenv()
URL = os.environ["DATABASE_URL"].replace("+asyncpg", "")

LEGACY_DDL = """
CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    clerk_id VARCHAR UNIQUE NOT NULL,
    email VARCHAR,
    full_name VARCHAR,
    avatar_url VARCHAR,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE TABLE workspaces (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR,
    slug VARCHAR UNIQUE,
    currency VARCHAR DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE TABLE memberships (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    role VARCHAR DEFAULT 'owner',
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);
-- exact 001 shape
CREATE TABLE planner_boards (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE planner_todos (
    id VARCHAR PRIMARY KEY,
    board_id VARCHAR NOT NULL REFERENCES planner_boards(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    description TEXT,
    column_id VARCHAR NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    due_date TIMESTAMP WITH TIME ZONE,
    priority VARCHAR NOT NULL DEFAULT 'medium',
    labels JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE TABLE projects (id VARCHAR(36) PRIMARY KEY);
"""

SEED = """
INSERT INTO users (id, clerk_id, email, full_name) VALUES ('u1', 'user_legacy', 'legacy@x.com', 'Legacy User');
INSERT INTO workspaces (id, name, slug) VALUES ('w1', 'Legacy WS', 'legacy-ws');
INSERT INTO memberships (id, user_id, workspace_id, role) VALUES ('m1', 'u1', 'w1', 'owner');
INSERT INTO planner_boards (id, user_id, title) VALUES ('b1', 'u1', 'My legacy board');
INSERT INTO planner_boards (id, user_id, title) VALUES ('b_orphan', 'u_missing', 'Orphan board');
INSERT INTO planner_todos (id, board_id, title, column_id, due_date)
VALUES ('t1', 'b1', 'Legacy todo', 'todo', '2026-09-01 10:00:00+00');
"""


def direct(url: str) -> str:
    return re.sub(r"-pooler\.", ".", url, count=1)


async def main() -> None:
    admin = await asyncpg.connect(direct(URL))
    try:
        await admin.execute("DROP DATABASE IF EXISTS fb_mig_test WITH (FORCE)")
        await admin.execute("CREATE DATABASE fb_mig_test")
    finally:
        await admin.close()

    scratch_url = URL.rsplit("/", 1)[0] + "/fb_mig_test"
    conn = await asyncpg.connect(scratch_url)
    try:
        await conn.execute(LEGACY_DDL)
        await conn.execute(SEED)

        migration = open(
            os.path.join(os.path.dirname(__file__), "..", "migrations", "021_planner_model_alignment.sql"),
            encoding="utf-8",
        ).read()
        await conn.execute(migration)

        boards = await conn.fetch("SELECT * FROM planner_boards ORDER BY id")
        print("boards:", [dict(b) for b in boards])
        todos = await conn.fetch("SELECT * FROM planner_todos")
        print("todos:", [dict(t) for t in todos])
        todo_cols = await conn.fetch(
            "SELECT column_name, data_type, is_nullable FROM information_schema"
            ".columns WHERE table_name='planner_todos' ORDER BY ordinal_position"
        )
        print("todo cols:", [(c["column_name"], c["data_type"], c["is_nullable"]) for c in todo_cols])
        board_cols = await conn.fetch(
            "SELECT column_name, is_nullable FROM information_schema"
            ".columns WHERE table_name='planner_boards' ORDER BY ordinal_position"
        )
        print("board cols:", [(c["column_name"], c["is_nullable"]) for c in board_cols])

        # Re-run must be a clean no-op.
        await conn.execute(migration)
        print("re-run: OK")

        # Insert path the API uses must work post-migration.
        await conn.execute(
            "INSERT INTO planner_boards (id, workspace_id, name, revision, elements, files)"
            " VALUES ('b2', 'w1', 'Untitled board', 0, '[]'::json, '{}'::json)"
        )
        print("model insert: OK")
    finally:
        await conn.close()

    admin = await asyncpg.connect(direct(URL))
    try:
        await admin.execute("DROP DATABASE fb_mig_test WITH (FORCE)")
        print("scratch database dropped")
    finally:
        await admin.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
