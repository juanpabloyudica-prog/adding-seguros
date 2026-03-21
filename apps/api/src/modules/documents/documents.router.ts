import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import { createModuleLogger } from '../../shared/logger.js'

// Service-role client for generating signed URLs and managing storage
const supabaseAdmin = createClient(
  process.env['SUPABASE_URL'] ?? '',
  process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? ''
)

const STORAGE_BUCKET = 'documents'
const SIGNED_URL_TTL = 3600 // 1 hour in seconds

export const documentsRouter = Router()
const log = createModuleLogger('documents.router')

// ─── Schemas ──────────────────────────────────────────────────────────────────
const ENTITY_TYPES = ['policy', 'case', 'quote', 'person'] as const

const createDocSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES),
  entity_id:   z.string().uuid(),
  type:        z.string().min(1).max(100),   // 'poliza_pdf', 'cedula', 'cotizacion', etc.
  // file_url accepts both storage paths (org_id/entity/...) and full https:// URLs.
  // Paths are resolved to signed URLs at read time via the /signed-url endpoint.
  file_url:    z.string().min(1).max(2000),
  file_name:   z.string().min(1).max(300),
  file_size:   z.number().int().positive().optional(),
  mime_type:   z.string().max(100).optional(),
  is_public:   z.boolean().default(false),
})

const listDocSchema = z.object({
  entity_type: z.enum(ENTITY_TYPES).optional(),
  entity_id:   z.string().uuid().optional(),
  type:        z.string().max(100).optional(),
  search:      z.string().max(200).optional(),   // search by file_name ILIKE
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(30),
})

const docIdSchema = z.object({ id: z.string().uuid() })

// ─── GET /api/documents ────────────────────────────────────────────────────────
documentsRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listDocSchema.parse(req.query)
    const { page, limit, entity_type, entity_id, type, search } = params
    const offset = (page - 1) * limit

    const conds: string[] = ['d.org_id = $1']
    const vals: unknown[] = [req.auth.orgId]
    let idx = 2

    if (entity_type) { conds.push(`d.entity_type = $${idx}`); vals.push(entity_type); idx++ }
    if (entity_id)   { conds.push(`d.entity_id = $${idx}`);   vals.push(entity_id);   idx++ }
    if (type)        { conds.push(`d.type = $${idx}`);         vals.push(type);        idx++ }
    if (search)      { conds.push(`d.file_name ILIKE $${idx}`); vals.push(`%${search}%`); idx++ }

    const whereClause = conds.join(' AND ')

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM documents d WHERE ${whereClause}`, vals
    )
    const total = parseInt(countRow?.count ?? '0', 10)

    // Join entity name for display — resolve from the relevant table
    const docs = await queryMany<{
      id: string; entity_type: string; entity_id: string; type: string
      file_url: string; file_name: string; file_size: number | null
      mime_type: string | null; is_public: boolean; created_at: string
      uploaded_by_name: string | null
      entity_name: string | null   // resolved from person/policy/quote/case
    }>(
      `SELECT d.*,
              u.full_name AS uploaded_by_name,
              CASE d.entity_type
                WHEN 'person' THEN (SELECT full_name FROM persons  WHERE id = d.entity_id LIMIT 1)
                WHEN 'policy' THEN (SELECT policy_number FROM policies WHERE id = d.entity_id LIMIT 1)
                WHEN 'quote'  THEN (SELECT pe.full_name FROM quotes q JOIN persons pe ON pe.id = q.person_id WHERE q.id = d.entity_id LIMIT 1)
                WHEN 'case'   THEN (SELECT title FROM cases WHERE id = d.entity_id LIMIT 1)
              END AS entity_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE ${whereClause}
       ORDER BY d.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...vals, limit, offset]
    )

    const { buildPaginatedResponse } = await import('@adding/utils')
    res.json(buildPaginatedResponse(docs, total, page, limit))
  } catch (err) { next(err) }
})

// ─── GET /api/documents/:id ────────────────────────────────────────────────────
documentsRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = docIdSchema.parse(req.params)
    const doc = await queryOne(
      `SELECT d.*, u.full_name AS uploaded_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.id = $1 AND d.org_id = $2 LIMIT 1`,
      [id, req.auth.orgId]
    )
    if (!doc) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }); return }
    res.json({ data: doc })
  } catch (err) { next(err) }
})

// ─── POST /api/documents ───────────────────────────────────────────────────────
// Registers document metadata. Actual file upload is handled by the client
// directly to Supabase Storage — we only store the resulting URL here.
documentsRouter.post('/', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createDocSchema.parse(req.body)

    // Verify entity belongs to this org
    const entityTable = input.entity_type === 'policy' ? 'policies'
      : input.entity_type === 'case'   ? 'cases'
      : input.entity_type === 'quote'  ? 'quotes'
      : 'persons'

    const entityExists = await queryOne<{ id: string }>(
      `SELECT id FROM ${entityTable} WHERE id = $1 AND org_id = $2 LIMIT 1`,
      [input.entity_id, req.auth.orgId]
    )
    if (!entityExists) {
      res.status(400).json({ error: { code: 'ENTITY_NOT_FOUND', message: `${input.entity_type} not found in this organization` } })
      return
    }

    const doc = await queryOne(
      `INSERT INTO documents
         (org_id, entity_type, entity_id, type, file_url, file_name, file_size, mime_type, is_public, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.auth.orgId, input.entity_type, input.entity_id, input.type,
        input.file_url, input.file_name, input.file_size ?? null,
        input.mime_type ?? null, input.is_public, req.auth.userId,
      ]
    )

    log.info({ docId: (doc as {id:string}).id, entityType: input.entity_type, orgId: req.auth.orgId }, 'Document registered')
    res.status(201).json({ data: doc })
  } catch (err) { next(err) }
})


// ─── POST /api/documents/:id/signed-url ──────────────────────────────────────
// Generates a short-lived signed URL for a private storage file.
// Uses the service-role client so no Supabase auth token is needed on the upload.
// Returns: { data: { signed_url: string; expires_at: string } }
documentsRouter.post('/:id/signed-url', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = docIdSchema.parse(req.params)
    const expiresIn: number = z.coerce.number().int().min(60).max(86400).default(3600).parse(req.query['expires_in'] ?? 3600)

    const doc = await queryOne<{ file_url: string; is_public: boolean }>(
      `SELECT file_url, is_public FROM documents WHERE id = $1 AND org_id = $2 LIMIT 1`,
      [id, req.auth.orgId]
    )
    if (!doc) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }); return }

    // If already a full URL, return it directly (external files, legacy)
    if (doc.file_url.startsWith('http://') || doc.file_url.startsWith('https://')) {
      res.json({ data: { signed_url: doc.file_url, expires_at: null } })
      return
    }

    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.file_url, expiresIn)

    if (error || !data?.signedUrl) {
      log.error({ error, docId: id }, 'Failed to generate signed URL')
      res.status(502).json({ error: { code: 'STORAGE_ERROR', message: 'Could not generate download URL' } })
      return
    }

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    res.json({ data: { signed_url: data.signedUrl, expires_at: expiresAt } })
  } catch (err) { next(err) }
})

// ─── GET /api/documents/quote/:quoteId/pdf-data ───────────────────────────────
// Returns the structured data needed to generate a commercial quote PDF.
// The actual PDF generation happens client-side or in a separate worker.
// This endpoint provides the canonical data shape.
documentsRouter.get('/quote/:quoteId/pdf-data', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const quoteId = z.string().uuid().parse(req.params.quoteId)

    // Load quote with all required joins for PDF generation
    const quote = await queryOne<{
      id: string; status: string; internal_recommendation: string | null
      selection_reason: string | null; sent_at: string | null; notes: string | null
      person_name: string | null; person_phone: string | null; person_email: string | null
      person_doc_type: string | null; person_doc_number: string | null
      risk_type: string | null; risk_data: Record<string, unknown> | null
      producer_name: string | null; producer_signature: string | null
      org_name: string | null
    }>(
      `SELECT
         q.id, q.status, q.internal_recommendation, q.selection_reason,
         q.sent_at, q.notes,
         pe.full_name     AS person_name,
         pe.phone         AS person_phone,
         pe.email         AS person_email,
         pe.doc_type      AS person_doc_type,
         pe.doc_number    AS person_doc_number,
         r.type           AS risk_type,
         r.data           AS risk_data,
         pu.full_name     AS producer_name,
         pr.signature_text AS producer_signature,
         o.name           AS org_name
       FROM quotes q
       JOIN persons pe   ON pe.id = q.person_id
       JOIN risks r      ON r.id  = q.risk_id
       JOIN organizations o ON o.id = q.org_id
       LEFT JOIN producers pr ON pr.id = q.producer_id
       LEFT JOIN users pu     ON pu.id = pr.user_id
       WHERE q.id = $1 AND q.org_id = $2 LIMIT 1`,
      [quoteId, req.auth.orgId]
    )

    if (!quote) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Quote not found' } })
      return
    }

    // Load options with company info
    const options = await queryMany<{
      id: string; plan_name: string; premium: number; currency: string
      coverage: Record<string, unknown>; company_ranking: number | null
      is_sent_to_client: boolean; is_selected: boolean
      internal_notes: string | null; payment_options: Record<string, unknown> | null
      company_name: string | null; company_logo_url: string | null
    }>(
      `SELECT
         qo.id, qo.plan_name, qo.premium, qo.currency,
         qo.coverage, qo.company_ranking, qo.is_sent_to_client,
         qo.is_selected, qo.internal_notes, qo.payment_options,
         co.name AS company_name, co.logo_url AS company_logo_url
       FROM quote_options qo
       JOIN companies co ON co.id = qo.company_id
       WHERE qo.quote_id = $1
       ORDER BY qo.sort_order ASC, qo.premium ASC`,
      [quoteId]
    )

    res.json({
      data: {
        quote,
        options,
        // Client-facing options only (for the commercial PDF)
        options_for_client: options.filter(o => o.is_sent_to_client),
        selected_option:    options.find(o => o.is_selected) ?? null,
        generated_at:       new Date().toISOString(),
      }
    })
  } catch (err) { next(err) }
})
