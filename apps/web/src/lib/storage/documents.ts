/**
 * Document storage via Supabase Storage.
 *
 * ARCHITECTURE DECISION: Supabase Storage (real, not mocked)
 *
 * Upload flow:
 *   1. Browser calls uploadDocument() → uploads directly to Supabase Storage
 *   2. On success, calls POST /api/documents to register metadata in our DB
 *   3. Returns the registered Document row including the storage path
 *
 * URL strategy:
 *   - Files are stored in a PRIVATE bucket ('documents')
 *   - The `file_url` column stores the storage path (not a public URL)
 *   - To share a file, call getSignedUrl() which generates a time-limited URL
 *   - For internal use (same org), signed URLs expire in 1 hour
 *   - The propuesta page generates signed URLs on demand for PDFs
 *
 * Path convention: {org_id}/{entity_type}/{entity_id}/{timestamp}-{filename}
 *   e.g. "abc123/quote/def456/1700000000000-propuesta.pdf"
 *
 * This makes RLS trivial: every user can only access paths starting with their org_id.
 */

import { getSupabaseClient } from '@/lib/supabase/client'
import { registerDocument } from '@/lib/api/documents'
import type { Document } from '@/lib/api/documents'

const BUCKET = 'documents'

export interface UploadOptions {
  orgId:       string
  entityType:  'policy' | 'case' | 'quote' | 'person'
  entityId:    string
  docType:     string        // e.g. 'cotizacion', 'poliza_pdf', 'cedula', 'informe'
  file:        File
  isPublic?:   boolean
  onProgress?: (pct: number) => void
}

export interface UploadResult {
  document: Document
  storagePath: string
  signedUrl:   string
}

export class StorageError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = 'StorageError'
  }
}

/**
 * Builds the storage path for a file.
 * Format: {org_id}/{entity_type}/{entity_id}/{timestamp}-{sanitized_name}
 */
export function buildStoragePath(
  orgId: string, entityType: string, entityId: string, fileName: string
): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200)
  return `${orgId}/${entityType}/${entityId}/${Date.now()}-${safeName}`
}

/**
 * Uploads a file to Supabase Storage and registers it in the documents table.
 * Returns the registered Document row and a signed URL valid for 1 hour.
 */
export async function uploadDocument(options: UploadOptions): Promise<UploadResult> {
  const { orgId, entityType, entityId, docType, file, isPublic = false, onProgress } = options

  const supabase    = getSupabaseClient()
  const storagePath = buildStoragePath(orgId, entityType, entityId, file.name)

  // ── 1. Upload to Supabase Storage ─────────────────────────────────────────
  onProgress?.(10)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      // Supabase enforces allowed_mime_types at the bucket level.
    // Supported: application/pdf, text/html, image/*, application/msword, etc.
    contentType:  file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert:       false,   // never overwrite — path includes timestamp
    })

  if (uploadError) {
    throw new StorageError(
      `Upload failed: ${uploadError.message}`,
      (uploadError as { error?: string }).error ?? 'UPLOAD_ERROR'
    )
  }

  onProgress?.(60)

  // ── 2. Generate signed URL (1 hour) ────────────────────────────────────────
  const { data: signedData, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (signError || !signedData?.signedUrl) {
    throw new StorageError(`Failed to generate signed URL: ${signError?.message}`)
  }

  onProgress?.(75)

  // ── 3. Register metadata in our documents table ────────────────────────────
  const result = await registerDocument({
    entity_type: entityType,
    entity_id:   entityId,
    type:        docType,
    file_url:    storagePath,   // store path, not URL — URLs are generated on demand
    file_name:   file.name,
    file_size:   file.size,
    mime_type:   file.type || null,
    is_public:   isPublic,
  })

  onProgress?.(100)

  return {
    document:    result.data,
    storagePath,
    signedUrl:   signedData.signedUrl,
  }
}

/**
 * Generates a signed URL for a document stored in Supabase Storage.
 * `fileUrl` is the storage path stored in the `documents.file_url` column.
 * `expiresIn` is in seconds (default: 3600 = 1 hour).
 */
export async function getSignedUrl(fileUrl: string, expiresIn = 3600): Promise<string> {
  // If already a full URL (http/https), return as-is — legacy or external URL
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl
  }

  const supabase = getSupabaseClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fileUrl, expiresIn)

  if (error || !data?.signedUrl) {
    throw new StorageError(`Failed to generate signed URL: ${error?.message}`)
  }

  return data.signedUrl
}

/**
 * Deletes a file from Supabase Storage.
 * Does NOT delete the documents table row — that's handled by the caller.
 */
export async function deleteStorageFile(storagePath: string): Promise<void> {
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return  // external URL — cannot delete from storage
  }
  const supabase = getSupabaseClient()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) throw new StorageError(`Delete failed: ${error.message}`)
}
