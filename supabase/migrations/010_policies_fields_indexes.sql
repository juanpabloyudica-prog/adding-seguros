-- ─────────────────────────────────────────────────────────────────────────────
-- 010_policies_fields_indexes.sql
--
-- 1. Adjusts the `status` CHECK constraint on policies to the new enum.
-- 2. Adds: sum_insured, cancellation_date, renewal_status, renewed_from_id.
-- 3. Renames payment_frequency values to match English conventions (monthly etc.)
--    via a new CHECK — old rows are migrated in the same transaction.
-- 4. Adds missing performance indexes.
--
-- DESIGN NOTE on `expiring`:
--   `expiring` is NOT stored as a status value in the DB. It is a computed
--   state returned by the API when status='active' AND end_date is within
--   the alert window. Storing it would require a background job to keep it
--   in sync and would cause race conditions. The API computes it on read.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. Drop old status CHECK, add new one ────────────────────────────────────
ALTER TABLE policies
  DROP CONSTRAINT IF EXISTS policies_status_check;

ALTER TABLE policies
  ADD CONSTRAINT policies_status_check
  CHECK (status IN ('draft','active','expired','cancelled'));

-- Migrate any rows with old status values to their new equivalents
UPDATE policies SET status = 'active'    WHERE status = 'pending_renewal';
UPDATE policies SET status = 'cancelled' WHERE status = 'suspended';

-- ─── 2. Add new columns ───────────────────────────────────────────────────────
ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS sum_insured       numeric(16,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancellation_date date          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS renewal_status    text          DEFAULT NULL
    CHECK (renewal_status IN ('pending','quoted','renewed','lost') OR renewal_status IS NULL),
  -- Points to the policy this one was renewed FROM (not the new one).
  -- Allows traversal of the full renewal chain in both directions.
  ADD COLUMN IF NOT EXISTS renewed_from_id   uuid          DEFAULT NULL
    REFERENCES policies(id);

-- ─── 3. Fix payment_frequency CHECK ──────────────────────────────────────────
-- Old values were Spanish (mensual/trimestral/semestral/anual).
-- New values are English to match the shared type enum.
ALTER TABLE policies
  DROP CONSTRAINT IF EXISTS policies_payment_frequency_check;

-- Migrate existing data before adding the new constraint
UPDATE policies SET payment_frequency = 'monthly'   WHERE payment_frequency = 'mensual';
UPDATE policies SET payment_frequency = 'quarterly'  WHERE payment_frequency = 'trimestral';
UPDATE policies SET payment_frequency = 'semi_annual' WHERE payment_frequency = 'semestral';
UPDATE policies SET payment_frequency = 'annual'    WHERE payment_frequency = 'anual';

ALTER TABLE policies
  ADD CONSTRAINT policies_payment_frequency_check
  CHECK (payment_frequency IN ('monthly','quarterly','semi_annual','annual') OR payment_frequency IS NULL);

-- ─── 4. Add missing performance indexes ──────────────────────────────────────

-- Composite: the most common query pattern — person's policies
CREATE INDEX IF NOT EXISTS idx_policies_org_person
  ON policies (org_id, person_id);

-- Active policies by producer (cartera view)
CREATE INDEX IF NOT EXISTS idx_policies_org_producer_active
  ON policies (org_id, producer_id)
  WHERE status = 'active';

-- Expiring soon — used by GET /policies/expiring and scheduler alerts
-- Covers active policies ordered by end_date for the alert window query
CREATE INDEX IF NOT EXISTS idx_policies_expiring
  ON policies (org_id, end_date)
  WHERE status = 'active';

-- Renewal tracking
CREATE INDEX IF NOT EXISTS idx_policies_renewal_status
  ON policies (org_id, renewal_status)
  WHERE renewal_status IS NOT NULL;

-- Chain traversal: find what a policy was renewed into
CREATE INDEX IF NOT EXISTS idx_policies_renewed_from
  ON policies (renewed_from_id)
  WHERE renewed_from_id IS NOT NULL;

COMMIT;
