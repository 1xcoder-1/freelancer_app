-- ============================================================================
-- 006_person_dedup_indexes.sql
-- One person = one row: unique (workspace_id, lower(email)) on clients and
-- leads, backed by the app-level 409 dedup checks in app/core/dedup.py.
--
-- The indexes can only exist once legacy duplicates are gone, so this file
-- first repairs the data. The repair is deliberately conservative: a newer
-- duplicate is deleted ONLY when nothing references it (no invoices, projects,
-- contracts, proposals, intake forms, contacts, appointments, or interaction
-- touches). Anything with history is left alone and the guard below fails
-- the migration with a count instead of silently re-pointing or deleting
-- business data - those rows need a human merge decision.
--
-- Every statement is idempotent: re-running after success is a no-op, and
-- CREATE UNIQUE INDEX IF NOT EXISTS keeps the guard honest on repeat runs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Clients - drop orphaned newer duplicates (keep the oldest row per
--    workspace + lower(email); id breaks created_at ties deterministically)
-- ---------------------------------------------------------------------------
DELETE FROM clients c
USING clients keep
WHERE c.workspace_id = keep.workspace_id
  AND lower(c.email) = lower(keep.email)
  AND c.id <> keep.id
  AND (c.created_at, c.id) > (keep.created_at, keep.id)
  AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM contracts ct WHERE ct.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM proposals pr WHERE pr.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM intake_forms inf WHERE inf.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM client_contacts cc WHERE cc.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM booking_appointments ba WHERE ba.client_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM interactions ix
                  WHERE ix.person_type = 'client' AND ix.person_id = c.id);

-- ---------------------------------------------------------------------------
-- 2. Leads - same rule; the only touch pointer is the polymorphic
--    interactions row (no FK anywhere else references leads)
-- ---------------------------------------------------------------------------
DELETE FROM leads l
USING leads keep
WHERE l.workspace_id = keep.workspace_id
  AND lower(l.email) = lower(keep.email)
  AND l.id <> keep.id
  AND (l.created_at, l.id) > (keep.created_at, keep.id)
  AND NOT EXISTS (SELECT 1 FROM interactions ix
                  WHERE ix.person_type = 'lead' AND ix.person_id = l.id);

-- ---------------------------------------------------------------------------
-- 3. Guard - duplicates that carry history survive step 1/2 on purpose; they
--    must be merged manually (re-point the FKs to the kept row, then re-run).
-- ---------------------------------------------------------------------------
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad FROM (
    SELECT 1 FROM clients GROUP BY workspace_id, lower(email) HAVING count(*) > 1
  ) d;
  IF bad > 0 THEN
    RAISE EXCEPTION '006: % client email duplicate group(s) still have dependents - merge them manually, then re-run', bad;
  END IF;

  SELECT count(*) INTO bad FROM (
    SELECT 1 FROM leads GROUP BY workspace_id, lower(email) HAVING count(*) > 1
  ) d;
  IF bad > 0 THEN
    RAISE EXCEPTION '006: % lead email duplicate group(s) still have interaction history - merge them manually, then re-run', bad;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The actual constraint the API race-guards against
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_workspace_email ON clients (workspace_id, lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_workspace_email ON leads (workspace_id, lower(email));
