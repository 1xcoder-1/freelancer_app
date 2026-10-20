-- Google Meet on/off for bookings: when off, synced Google events are created
-- without a Meet conference and new appointments get no (fake) meeting link.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

ALTER TABLE google_calendar_connections
    ADD COLUMN IF NOT EXISTS meet_enabled BOOLEAN NOT NULL DEFAULT TRUE;
