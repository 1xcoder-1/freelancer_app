-- ============================================================================
-- 004_productivity_schema.sql
-- Freelancer productivity features: the schema for all seven page workstreams
-- (clients, leads, projects, contracts, invoices, planner, booking).
--
-- In development the app auto-syncs ORM columns on startup and SQLite
-- auto-creates the new tables; THIS file is the explicit, idempotent path for
-- any environment that does not (Neon / production). Every statement uses
-- IF NOT EXISTS so it is safe to re-run. All added columns are nullable or
-- carry a default, so no existing row is ever orphaned.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- F2: one append-only touch table for leads + clients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interactions (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    person_type VARCHAR(20) NOT NULL,
    person_id VARCHAR(36) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'note',
    direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
    summary VARCHAR(2000),
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    next_action_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_interactions_workspace_id ON interactions (workspace_id);
CREATE INDEX IF NOT EXISTS ix_interactions_person_type ON interactions (person_type);
CREATE INDEX IF NOT EXISTS ix_interactions_person ON interactions (person_type, person_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Workstream 1 — Project Documents / Files
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS project_files (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_key VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(120),
    size_bytes INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(50) NOT NULL DEFAULT 'document'
);
CREATE INDEX IF NOT EXISTS ix_project_files_workspace_id ON project_files (workspace_id);
CREATE INDEX IF NOT EXISTS ix_project_files_project_id ON project_files (project_id);

-- ---------------------------------------------------------------------------
-- Workstream 5 — Invoices (V1 token + partial payments, V2/V3/V4)
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS token VARCHAR(64);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS late_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remind_days JSON NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminders_sent JSON NOT NULL DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS active_until TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_token ON invoices (token);
CREATE INDEX IF NOT EXISTS ix_invoices_project_id ON invoices (project_id);

CREATE TABLE IF NOT EXISTS invoice_payments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    reference VARCHAR(255),
    note TEXT,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_invoice_payments_workspace_id ON invoice_payments (workspace_id);
CREATE INDEX IF NOT EXISTS ix_invoice_payments_invoice ON invoice_payments (invoice_id, paid_at);

-- V6: record which invoice billed a time entry so deleting that invoice can
-- re-open exactly the hours it had stamped (previously they leaked to
-- is_invoiced=True forever and disappeared from "unbilled time").
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(36) REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_time_entries_invoice_id ON time_entries (invoice_id);

-- ---------------------------------------------------------------------------
-- Workstream 3 — Projects (P1/P2 dates, P4 task dates, P6 sign-off, P3 CRs)
-- ---------------------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS portal_recipient_email VARCHAR(255);
CREATE INDEX IF NOT EXISTS ix_projects_due_date ON projects (due_date);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
CREATE INDEX IF NOT EXISTS ix_tasks_project_due ON tasks (project_id, due_date);

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS change_requests (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    detail TEXT,
    price DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    impact_days INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'requested',
    requested_by VARCHAR(255),
    decided_at TIMESTAMP,
    decision_note TEXT
);
CREATE INDEX IF NOT EXISTS ix_change_requests_workspace_id ON change_requests (workspace_id);
CREATE INDEX IF NOT EXISTS ix_change_requests_project_id ON change_requests (project_id);
CREATE INDEX IF NOT EXISTS ix_change_requests_status ON change_requests (status);

-- ---------------------------------------------------------------------------
-- Workstream 4 — Contracts (N2 expiry, N5 versions, N6 execution, N1/N4 tables)
-- ---------------------------------------------------------------------------
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS expire_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS supersedes_id VARCHAR(36) REFERENCES contracts(id) ON DELETE SET NULL;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS fully_executed_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS contract_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    contract_id VARCHAR(36) NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    event VARCHAR(40) NOT NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_ip VARCHAR(128),
    actor_user_agent VARCHAR(512),
    note TEXT
);
CREATE INDEX IF NOT EXISTS ix_contract_events_workspace_id ON contract_events (workspace_id);
CREATE INDEX IF NOT EXISTS ix_contract_events_contract_id ON contract_events (contract_id);

CREATE TABLE IF NOT EXISTS contract_templates (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    is_default BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_contract_templates_workspace_id ON contract_templates (workspace_id);

-- ---------------------------------------------------------------------------
-- Workstream 2 — Leads (L3 loss reason, L5 first contact) + L4 proposal expiry
-- ---------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reason_lost VARCHAR(30);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reason_lost_note TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMP;

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS ix_proposals_expires_at ON proposals (expires_at);

-- ---------------------------------------------------------------------------
-- Workstream 6 — Planner (PL1/PL2/PL3 todo fields, PL5 share, PL4 snapshots)
-- ---------------------------------------------------------------------------
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium';
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20);
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS "date" DATE;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS start_minute INTEGER;
ALTER TABLE planner_todos ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
CREATE INDEX IF NOT EXISTS ix_planner_todos_due_date ON planner_todos (due_date);
CREATE INDEX IF NOT EXISTS ix_planner_todos_project_id ON planner_todos (project_id);
CREATE INDEX IF NOT EXISTS ix_planner_todos_date ON planner_todos ("date");

ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE planner_boards ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
CREATE UNIQUE INDEX IF NOT EXISTS ix_planner_boards_share_token ON planner_boards (share_token);

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
CREATE INDEX IF NOT EXISTS ix_planner_snapshots_board_id ON planner_snapshots (board_id);
CREATE INDEX IF NOT EXISTS ix_planner_snapshots_workspace_id ON planner_snapshots (workspace_id);

-- ---------------------------------------------------------------------------
-- Workstream 7 — Booking (B1/B2 availability + guards, B3 status, B4 payments)
-- ---------------------------------------------------------------------------
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS weekday_mask VARCHAR(7) NOT NULL DEFAULT '1111100';
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS start_minute INTEGER NOT NULL DEFAULT 540;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS end_minute INTEGER NOT NULL DEFAULT 1020;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC';
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS min_lead_hours INTEGER NOT NULL DEFAULT 2;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS max_advance_days INTEGER NOT NULL DEFAULT 60;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS intake_form_id VARCHAR(36) REFERENCES intake_forms(id) ON DELETE SET NULL;
ALTER TABLE booking_consultations ADD COLUMN IF NOT EXISTS no_show_limit INTEGER NOT NULL DEFAULT 2;

ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS token VARCHAR(64);
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS no_show BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(36) REFERENCES invoices(id) ON DELETE SET NULL;
ALTER TABLE booking_appointments ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) REFERENCES clients(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ix_booking_appointments_token ON booking_appointments (token);
CREATE INDEX IF NOT EXISTS ix_booking_appointments_status ON booking_appointments (status);
CREATE INDEX IF NOT EXISTS ix_booking_appointments_appointment_time ON booking_appointments (appointment_time);

CREATE TABLE IF NOT EXISTS booking_blocked_days (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    consultation_id VARCHAR(36) NOT NULL REFERENCES booking_consultations(id) ON DELETE CASCADE,
    workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    "date" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_booking_blocked_days_workspace_id ON booking_blocked_days (workspace_id);
CREATE INDEX IF NOT EXISTS ix_booking_blocked_days_consultation_id ON booking_blocked_days (consultation_id);

-- ---------------------------------------------------------------------------
-- Backfill: give every pre-existing invoice a public payment token (V1) so a
-- previously-issued invoice can be paid the moment this migration lands.
-- ---------------------------------------------------------------------------
UPDATE invoices SET token = REPLACE(gen_random_uuid()::text, '-', '') WHERE token IS NULL;
