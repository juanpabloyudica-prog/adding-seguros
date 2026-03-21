import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  listCasesSchema, caseIdParamSchema, createCaseSchema,
  updateCaseSchema, transitionCaseStatusSchema, transitionStepSchema,
  closeCaseSchema, addTimelineNoteSchema, linkConversationSchema,
} from './cases.schema.js'
import {
  getCaseById, getCases, createNewCase, updateExistingCase,
  transitionStatus, transitionStep, closeCaseById, addNote, linkConversation,
} from './cases.service.js'
import { queryMany } from '../../infrastructure/db/client.js'

export const casesRouter = Router()

// GET /api/cases
casesRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getCases(req.auth.orgId, listCasesSchema.parse(req.query)))
  } catch (err) { next(err) }
})

// GET /api/cases/:id
casesRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    res.json({ data: await getCaseById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/cases
casesRouter.post('/', requireRole('operativo'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCaseSchema.parse(req.body)
    res.status(201).json({ data: await createNewCase(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/cases/:id
casesRouter.patch('/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    res.json({ data: await updateExistingCase(id, req.auth.orgId, updateCaseSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/cases/:id/status
casesRouter.patch('/:id/status', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    res.json({ data: await transitionStatus(id, req.auth.orgId, transitionCaseStatusSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/cases/:id/step
casesRouter.patch('/:id/step', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    res.json({ data: await transitionStep(id, req.auth.orgId, transitionStepSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/cases/:id/close
casesRouter.post('/:id/close', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    res.json({ data: await closeCaseById(id, req.auth.orgId, closeCaseSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/cases/:id/timeline/notes
casesRouter.post('/:id/timeline/notes', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    const entry = await addNote(id, req.auth.orgId, addTimelineNoteSchema.parse(req.body), req.auth.userId)
    res.status(201).json({ data: entry })
  } catch (err) { next(err) }
})

// POST /api/cases/:id/link-conversation
casesRouter.post('/:id/link-conversation', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    await linkConversation(id, req.auth.orgId, linkConversationSchema.parse(req.body), req.auth.userId)
    res.status(204).send()
  } catch (err) { next(err) }
})

// GET /api/cases/:id/conversations — conversations linked to this case
casesRouter.get('/:id/conversations', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    const rows = await queryMany<{
      id: string; wa_phone: string; wa_contact_name: string | null
      status: string; unread_count: number; last_message_at: string | null
      last_message_text: string | null
    }>(
      `SELECT c.id, c.wa_phone, c.wa_contact_name, c.status,
              c.unread_count, c.last_message_at, c.last_message_text
       FROM conversations c
       WHERE c.case_id = $1 AND c.org_id = $2
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [id, req.auth.orgId]
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})

// GET /api/cases/:id/documents — documents attached to this case
casesRouter.get('/:id/documents', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = caseIdParamSchema.parse(req.params)
    const rows = await queryMany<{
      id: string; type: string; file_name: string; file_url: string
      file_size: number | null; mime_type: string | null; created_at: string
      uploaded_by_name: string | null
    }>(
      `SELECT d.id, d.type, d.file_name, d.file_url, d.file_size, d.mime_type, d.created_at,
              u.full_name AS uploaded_by_name
       FROM documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.entity_type = 'case' AND d.entity_id = $1 AND d.org_id = $2
       ORDER BY d.created_at DESC`,
      [id, req.auth.orgId]
    )
    res.json({ data: rows })
  } catch (err) { next(err) }
})
