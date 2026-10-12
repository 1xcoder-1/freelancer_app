-- Booking → Google Calendar write-through: appointments that get a real
-- Meet-enabled Google event store its id here so reschedules PATCH and
-- cancellations cancel the same event instead of orphaning it.
-- In development the app auto-syncs ORM columns on startup; this file is the
-- explicit, idempotent path for any environment that does not.

ALTER TABLE booking_appointments
    ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS ix_booking_appointments_google_event_id
    ON booking_appointments (google_event_id);
