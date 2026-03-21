-- ─────────────────────────────────────────────────────────────────────────────
-- 012_storage_bucket.sql
--
-- Creates the Supabase Storage bucket for documents and configures RLS policies.
--
-- Bucket design:
--   - Name: 'documents'
--   - Private (is_public = false): all files require signed URLs or service-role
--   - Per-org path: {org_id}/{entity_type}/{entity_id}/{timestamp}-{filename}
--   - RLS enforced via CREATE POLICY ON storage.objects (standard Postgres syntax)
--
-- Allowed types: PDF, images, Office docs, plain text, HTML (for proposals)
-- File size limit: 50 MB
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create/update the bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,       -- private bucket: never publicly accessible
  52428800,    -- 50 MB per file
  ARRAY[
    'application/pdf',
    'text/html',          -- printable proposals (the HTML proposal format)
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Helper: verify the uploading user belongs to the org in the path ───────
-- storage.objects.name = the path segment AFTER the bucket name.
-- Convention: first segment is always the org_id UUID.
-- SECURITY DEFINER so the function can read public.users regardless of caller context.
CREATE OR REPLACE FUNCTION storage.user_owns_object_path(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id      = auth.uid()
      AND u.org_id  = SPLIT_PART(object_name, '/', 1)::uuid
      AND u.is_active = true
  )
$$;

-- ── 3. Storage RLS on storage.objects ─────────────────────────────────────────
-- RLS must be enabled on storage.objects (Supabase does this by default).
-- We add per-bucket policies using standard CREATE POLICY syntax.
-- All policies are scoped to bucket_id = 'documents'.

-- DROP existing policies for this bucket to allow idempotent re-runs
DROP POLICY IF EXISTS "documents: authenticated upload"  ON storage.objects;
DROP POLICY IF EXISTS "documents: authenticated read"    ON storage.objects;
DROP POLICY IF EXISTS "documents: authenticated delete"  ON storage.objects;

-- INSERT policy: user can only upload to their own org's prefix
-- The WITH CHECK validates the path at write time — even if the user manually
-- crafts a path with a different org_id UUID, the DB lookup will reject it.
CREATE POLICY "documents: authenticated upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND storage.user_owns_object_path(name)
);

-- SELECT policy: user can only read files in their own org's prefix
CREATE POLICY "documents: authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND storage.user_owns_object_path(name)
);

-- DELETE policy: user can delete their own org's files
CREATE POLICY "documents: authenticated delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND storage.user_owns_object_path(name)
);

-- Note: UPDATE is intentionally not granted.
-- Files in this bucket are immutable after upload (path includes timestamp).
-- To replace a file, upload a new one and delete the old one.

-- ── 4. Service-role bypass ────────────────────────────────────────────────────
-- The service-role key bypasses RLS entirely (Supabase default).
-- This is used by:
--   - POST /api/documents/:id/signed-url  (generates signed URLs)
--   - Any future server-side document processing
-- Never expose the service-role key to the browser.
