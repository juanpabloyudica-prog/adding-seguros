-- ─────────────────────────────────────────────────────────────────────────────
-- 011_policies_coverage_external.sql
--
-- 1. Adds coverage_summary (jsonb) to policies.
--    Stores a human-readable or structured coverage description without
--    requiring PDF parsing. Accepts both plain text and structured JSON.
--    Examples:
--      "TR 5% + granizo sin límite + cristales"
--      {"todo_riesgo": true, "franquicia": "5%", "granizo": "sin límite"}
--
-- 2. Adds external_policy_number and external_company_id to policies.
--    Used to map internal policy records to identifiers in insurer systems.
--    external_company_id is an opaque string (not a FK) because external
--    systems use their own identifiers which may not match our companies table.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS coverage_summary      jsonb  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_policy_number text   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS external_company_id   text   DEFAULT NULL;

-- Index for reverse-lookup: find our policy given an insurer's policy number
CREATE INDEX IF NOT EXISTS idx_policies_external_number
  ON policies (org_id, external_policy_number)
  WHERE external_policy_number IS NOT NULL;
