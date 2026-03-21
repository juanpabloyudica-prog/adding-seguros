import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  listQuotesSchema, quoteIdParamSchema, optionIdParamSchema,
  createQuoteSchema, updateQuoteSchema,
  addQuoteOptionSchema, updateQuoteOptionSchema,
  selectOptionSchema, markSentSchema,
} from './quotes.schema.js'
import {
  getQuoteById, getQuotes, createNewQuote, updateExistingQuote,
  addQuoteOption, updateQuoteOption, removeQuoteOption,
  markQuoteAsSent, selectQuoteOption,
} from './quotes.service.js'

export const quotesRouter = Router()

// GET /api/quotes
quotesRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getQuotes(req.auth.orgId, listQuotesSchema.parse(req.query))) }
  catch (err) { next(err) }
})

// GET /api/quotes/:id
quotesRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quoteIdParamSchema.parse(req.params)
    res.json({ data: await getQuoteById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/quotes
quotesRouter.post('/', requireRole('operativo'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createQuoteSchema.parse(req.body)
    res.status(201).json({ data: await createNewQuote(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/quotes/:id
quotesRouter.patch('/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quoteIdParamSchema.parse(req.params)
    res.json({ data: await updateExistingQuote(id, req.auth.orgId, updateQuoteSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/quotes/:id/options
quotesRouter.post('/:id/options', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quoteIdParamSchema.parse(req.params)
    res.status(201).json({ data: await addQuoteOption(id, req.auth.orgId, addQuoteOptionSchema.parse(req.body)) })
  } catch (err) { next(err) }
})

// PATCH /api/quotes/:id/options/:optionId
quotesRouter.patch('/:id/options/:optionId', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, optionId } = optionIdParamSchema.parse(req.params)
    res.json({ data: await updateQuoteOption(id, req.auth.orgId, optionId, updateQuoteOptionSchema.parse(req.body)) })
  } catch (err) { next(err) }
})

// DELETE /api/quotes/:id/options/:optionId
quotesRouter.delete('/:id/options/:optionId', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, optionId } = optionIdParamSchema.parse(req.params)
    await removeQuoteOption(id, req.auth.orgId, optionId)
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/quotes/:id/mark-sent  — mark options as sent to client
quotesRouter.post('/:id/mark-sent', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quoteIdParamSchema.parse(req.params)
    res.json({ data: await markQuoteAsSent(id, req.auth.orgId, markSentSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/quotes/:id/select-option  — client chose an option
quotesRouter.post('/:id/select-option', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = quoteIdParamSchema.parse(req.params)
    res.json({ data: await selectQuoteOption(id, req.auth.orgId, selectOptionSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})
