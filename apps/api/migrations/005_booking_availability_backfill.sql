-- ============================================================================
-- 005_booking_availability_backfill.sql
-- Repair pass for the B1/B2 availability columns on booking_consultations
-- (plus the NOT-NULL appointment status fields from the same batch).
--
-- Why this exists: on the Neon dev database these columns were added by the
-- startup auto-sync (init_db in app/core/database.py), which emits
-- "ADD COLUMN <name> <type>" only - no NOT NULL, no DEFAULT. Rows created
-- before the availability feature existed (the two auto-seeded default
-- consultations) therefore hold NULL in all eight availability columns.
-- 004 can never repair that: ADD COLUMN IF NOT EXISTS no-ops once the
-- column exists, and GET /api/v1/booking failed response validation
-- (8 non-optional schema fields x 2 rows = 16 errors, 500).
--
-- Order is safe in every state: the UPDATE backfills NULLs with the exact
-- defaults the BookingConsultation model carries, then SET DEFAULT /
-- SET NOT NULL re-aligns each column with the ORM so the drift cannot
-- return. Every statement is idempotent - re-running is a no-op.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Backfill - rows created before the columns existed (model defaults)
-- ---------------------------------------------------------------------------
UPDATE booking_consultations SET weekday_mask = '1111100' WHERE weekday_mask IS NULL;
UPDATE booking_consultations SET start_minute = 540 WHERE start_minute IS NULL;
UPDATE booking_consultations SET end_minute = 1020 WHERE end_minute IS NULL;
UPDATE booking_consultations SET timezone = 'UTC' WHERE timezone IS NULL;
UPDATE booking_consultations SET min_lead_hours = 2 WHERE min_lead_hours IS NULL;
UPDATE booking_consultations SET max_advance_days = 60 WHERE max_advance_days IS NULL;
UPDATE booking_consultations SET buffer_minutes = 0 WHERE buffer_minutes IS NULL;
UPDATE booking_consultations SET no_show_limit = 2 WHERE no_show_limit IS NULL;

-- BookingAppointmentOut keeps status / reschedule_count / no_show
-- non-optional, so a NULL on a pre-B3 appointment row would 500 the
-- appointments list and agenda the same way this consultation bug did.
UPDATE booking_appointments SET status = 'pending' WHERE status IS NULL;
UPDATE booking_appointments SET reschedule_count = 0 WHERE reschedule_count IS NULL;
UPDATE booking_appointments SET no_show = FALSE WHERE no_show IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Align with the model - defaults at the DB level, then NOT NULL, so raw
-- inserts and pre-ORM rows can never reintroduce the NULL drift
-- ---------------------------------------------------------------------------
ALTER TABLE booking_consultations ALTER COLUMN weekday_mask SET DEFAULT '1111100';
ALTER TABLE booking_consultations ALTER COLUMN weekday_mask SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN start_minute SET DEFAULT 540;
ALTER TABLE booking_consultations ALTER COLUMN start_minute SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN end_minute SET DEFAULT 1020;
ALTER TABLE booking_consultations ALTER COLUMN end_minute SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN timezone SET DEFAULT 'UTC';
ALTER TABLE booking_consultations ALTER COLUMN timezone SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN min_lead_hours SET DEFAULT 2;
ALTER TABLE booking_consultations ALTER COLUMN min_lead_hours SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN max_advance_days SET DEFAULT 60;
ALTER TABLE booking_consultations ALTER COLUMN max_advance_days SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN buffer_minutes SET DEFAULT 0;
ALTER TABLE booking_consultations ALTER COLUMN buffer_minutes SET NOT NULL;
ALTER TABLE booking_consultations ALTER COLUMN no_show_limit SET DEFAULT 2;
ALTER TABLE booking_consultations ALTER COLUMN no_show_limit SET NOT NULL;

ALTER TABLE booking_appointments ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE booking_appointments ALTER COLUMN status SET NOT NULL;
ALTER TABLE booking_appointments ALTER COLUMN reschedule_count SET DEFAULT 0;
ALTER TABLE booking_appointments ALTER COLUMN reschedule_count SET NOT NULL;
ALTER TABLE booking_appointments ALTER COLUMN no_show SET DEFAULT FALSE;
ALTER TABLE booking_appointments ALTER COLUMN no_show SET NOT NULL;
