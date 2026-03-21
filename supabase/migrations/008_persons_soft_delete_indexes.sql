-- ─────────────────────────────────────────────────────────────────────────────
-- 008_persons_soft_delete_indexes.sql
--
-- 1. Adds deleted_at to persons for soft delete support.
-- 2. Adds deleted_by for audit trail on who triggered the deletion.
-- 3. Fixes the UNIQUE constraint on (org_id, doc_type, doc_number) to only
--    enforce uniqueness on non-deleted rows.
-- 4. Adds performance indexes for the most common query patterns.
--
-- Safe to apply on an existing DB: all changes are additive (ALTER TABLE ADD
-- COLUMN with a default, DROP + CREATE INDEX, no data loss).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Add soft delete columns ───────────────────────────────────────────────
ALTER TABLE persons
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        REFERENCES users(id) DEFAULT NULL;

-- ─── 2. Fix the UNIQUE constraint ─────────────────────────────────────────────
-- The original UNIQUE (org_id, doc_type, doc_number) blocks re-inserting the
-- same document after a soft delete. Replace it with a partial unique index
-- that only applies to active (non-deleted) rows.
ALTER TABLE persons
  DROP CONSTRAINT IF EXISTS persons_org_id_doc_type_doc_number_key;

-- Partial unique: only active rows, and only when both doc fields are present.
-- (doc_type and doc_number can both be NULL for persons without a document.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_doc_unique_active
  ON persons (org_id, doc_type, doc_number)
  WHERE deleted_at IS NULL
    AND doc_type   IS NOT NULL
    AND doc_number IS NOT NULL;

-- ─── 3. Performance indexes ────────────────────────────────────────────────────

-- Composite covering index for the most common list query:
-- WHERE org_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_persons_org_active_created
  ON persons (org_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Full_name lookup for non-deleted rows (used in list + search)
CREATE INDEX IF NOT EXISTS idx_persons_org_fullname
  ON persons (org_id, full_name)
  WHERE deleted_at IS NULL;

-- Phone lookup for non-deleted rows (used by conversation service to identify callers)
-- Replaces the non-partial idx_persons_phone from 002
DROP INDEX IF EXISTS idx_persons_phone;
CREATE INDEX IF NOT EXISTS idx_persons_org_phone_active
  ON persons (org_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

-- Trigram index already exists from 002; drop + recreate filtered on active rows
DROP INDEX IF EXISTS idx_persons_fullname_trgm;
CREATE INDEX IF NOT EXISTS idx_persons_fullname_trgm
  ON persons USING GIN (full_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- ─── 4. Update RLS policy to exclude deleted rows ─────────────────────────────
-- The existing policy allows reading soft-deleted rows. Replace it so that
-- RLS itself filters them — even if a query forgets to add the WHERE clause.
DROP POLICY IF EXISTS persons_org_isolation ON persons;

CREATE POLICY persons_org_isolation ON persons
  FOR ALL USING (
    (is_service_role() OR org_id = auth_org_id())
    AND deleted_at IS NULL
  );

-- Separate policy for service role to be able to query deleted rows when needed
-- (e.g. audit queries, recovery operations). Only accessible with service key.
CREATE POLICY persons_deleted_service_only ON persons
  FOR SELECT USING (
    is_service_role() AND deleted_at IS NOT NULL
  );
