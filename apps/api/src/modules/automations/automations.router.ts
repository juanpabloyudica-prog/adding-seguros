import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import { queryMany, queryOne } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import {
  templateIdParamSchema, createTemplateSchema, updateTemplateSchema, previewTemplateSchema,
  ruleIdParamSchema, createRuleSchema, updateRuleSchema,
  scheduledIdParamSchema, listScheduledSchema, cancelScheduledSchema, manualTriggerSchema,
} from './automations.schema.js'
import { z } from 'zod'
import {
  getTemplates, getTemplateById, createNewTemplate, updateExistingTemplate, previewTemplate,
  getRules, getRuleById, createNewRule, updateExistingRule,
  getScheduledMessages, cancelMessage, manualTrigger,
} from './automations.service.js'

export const automationsRouter = Router()

// ─── Templates ────────────────────────────────────────────────────────────────

automationsRouter.get('/templates', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await getTemplates(req.auth.orgId) }) }
  catch (err) { next(err) }
})

automationsRouter.get('/templates/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = templateIdParamSchema.parse(req.params)
    res.json({ data: await getTemplateById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

automationsRouter.post('/templates', requireRole('admin'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTemplateSchema.parse(req.body)
    res.status(201).json({ data: await createNewTemplate(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

automationsRouter.patch('/templates/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = templateIdParamSchema.parse(req.params)
    res.json({ data: await updateExistingTemplate(id, req.auth.orgId, updateTemplateSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /automations/templates/:id/preview — render template with sample variables
automationsRouter.post('/templates/:id/preview', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = templateIdParamSchema.parse(req.params)
    const { body, variables } = previewTemplateSchema.parse(req.body)
    let templateBody = body
    if (!templateBody) {
      const t = await getTemplateById(id, req.auth.orgId)
      templateBody = t.body
    }
    res.json({ data: { preview: previewTemplate(templateBody, variables) } })
  } catch (err) { next(err) }
})

// ─── Rules ────────────────────────────────────────────────────────────────────

automationsRouter.get('/rules', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ data: await getRules(req.auth.orgId) }) }
  catch (err) { next(err) }
})

automationsRouter.get('/rules/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ruleIdParamSchema.parse(req.params)
    res.json({ data: await getRuleById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

automationsRouter.post('/rules', requireRole('admin'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRuleSchema.parse(req.body)
    res.status(201).json({ data: await createNewRule(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

automationsRouter.patch('/rules/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = ruleIdParamSchema.parse(req.params)
    res.json({ data: await updateExistingRule(id, req.auth.orgId, updateRuleSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// ─── Scheduled messages ───────────────────────────────────────────────────────

automationsRouter.get('/scheduled', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getScheduledMessages(req.auth.orgId, listScheduledSchema.parse(req.query))) }
  catch (err) { next(err) }
})

automationsRouter.delete('/scheduled/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = scheduledIdParamSchema.parse(req.params)
    const { reason } = cancelScheduledSchema.parse(req.body)
    res.json({ data: await cancelMessage(id, req.auth.orgId, req.auth.userId, reason) })
  } catch (err) { next(err) }
})

// POST /automations/trigger — manually fire a rule for a conversation
automationsRouter.post('/trigger', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = manualTriggerSchema.parse(req.body)
    res.status(201).json({ data: await manualTrigger(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// GET /automations/history — automation execution history from events table
automationsRouter.get('/history', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = z.object({
      page:    z.coerce.number().int().min(1).default(1),
      limit:   z.coerce.number().int().min(1).max(100).default(30),
      rule_id: z.string().uuid().optional(),
      action:  z.string().optional(),
    }).parse(req.query)

    const offset = (params.page - 1) * params.limit
    const conds: string[] = ['e.org_id = $1', "e.entity_type = 'automation'"]
    const vals: unknown[] = [req.auth.orgId]
    let idx = 2

    if (params.rule_id) {
      conds.push(`e.payload->>'rule_id' = $${idx}`)
      vals.push(params.rule_id); idx++
    }
    if (params.action) {
      conds.push(`e.action = $${idx}`)
      vals.push(params.action); idx++
    }

    const whereClause = conds.join(' AND ')

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM events e WHERE ${whereClause}`, vals
    )
    const total = parseInt(countRow?.count ?? '0', 10)

    const rows = await queryMany<{
      id: string; action: string; payload: Record<string, unknown>
      created_at: string; conversation_id: string | null; case_id: string | null
    }>(
      `SELECT e.id, e.action, e.payload, e.created_at, e.conversation_id, e.case_id
       FROM events e
       WHERE ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...vals, params.limit, offset]
    )

    res.json(buildPaginatedResponse(rows, total, params.page, params.limit))
  } catch (err) { next(err) }
})
