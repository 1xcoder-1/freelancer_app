-- ==============================================================================
-- Migration: 001_planner_and_calendar_schema.sql
-- Description: Create tables for Planner Boards, Todos, Calendar Events, & Leads
-- Compatible with: Neon PostgreSQL
-- ==============================================================================

-- 1. Planner Boards
CREATE TABLE IF NOT EXISTS planner_boards (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_planner_boards_user_id ON planner_boards (user_id);

-- 2. Planner Todos
CREATE TABLE IF NOT EXISTS planner_todos (
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

CREATE INDEX IF NOT EXISTS ix_planner_todos_board_id ON planner_todos (board_id);

-- 3. Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT FALSE NOT NULL,
    category VARCHAR DEFAULT 'other' NOT NULL,
    google_event_id VARCHAR,
    google_calendar_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_calendar_events_user_id ON calendar_events (user_id);
CREATE INDEX IF NOT EXISTS ix_calendar_events_start_time ON calendar_events (start_time);
CREATE INDEX IF NOT EXISTS ix_calendar_events_google_event_id ON calendar_events (google_event_id);

-- 4. Google Calendar Connections
CREATE TABLE IF NOT EXISTS google_calendar_connections (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_uri VARCHAR DEFAULT 'https://oauth2.googleapis.com/token' NOT NULL,
    client_id VARCHAR NOT NULL,
    client_secret VARCHAR NOT NULL,
    scopes JSONB NOT NULL,
    expiry TIMESTAMP WITH TIME ZONE,
    sync_token VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_google_calendar_connections_user_id ON google_calendar_connections (user_id);

-- 5. Leads CRM Table
CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    email VARCHAR,
    phone VARCHAR,
    company VARCHAR,
    status VARCHAR DEFAULT 'new' NOT NULL,
    source VARCHAR DEFAULT 'manual' NOT NULL,
    value DOUBLE PRECISION DEFAULT 0.0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_leads_user_id ON leads (user_id);
CREATE INDEX IF NOT EXISTS ix_leads_status ON leads (status);
