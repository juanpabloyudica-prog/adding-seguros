import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import {
  listConversationsSchema, conversationIdParamSchema,
  updateConversationSchema, escalateSchema,
  takeoverSchema, sendMessageSchema, listMessagesSchema,
} from './conversations.schema.js'
import {
  getConversationById, getConversations, getConversationMessages,
  updateConversationDetails, escalateConversation, deescalateConversation,
  takeoverConversation, releaseConversationLock, sendMessage,
} from './conversations.service.js'

export const conversationsRouter = Router()

// GET /api/conversations
conversationsRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listConversationsSchema.parse(req.query)
    res.json(await getConversations(req.auth.orgId, params))
  } catch (err) { next(err) }
})

// GET /api/conversations/:id
conversationsRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    res.json({ data: await getConversationById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// GET /api/conversations/:id/messages
conversationsRouter.get('/:id/messages', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    const params = listMessagesSchema.parse(req.query)
    const messages = await getConversationMessages(id, req.auth.orgId, params)
    res.json({ data: messages })
  } catch (err) { next(err) }
})

// PATCH /api/conversations/:id  — status, assign, link person/case
conversationsRouter.patch('/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    const input  = updateConversationSchema.parse(req.body)
    res.json({ data: await updateConversationDetails(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/conversations/:id/messages  — send message or internal note
conversationsRouter.post('/:id/messages', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id }  = conversationIdParamSchema.parse(req.params)
    const input   = sendMessageSchema.parse(req.body)
    const message = await sendMessage(id, req.auth.orgId, input, req.auth.userId)
    res.status(201).json({ data: message })
  } catch (err) { next(err) }
})

// POST /api/conversations/:id/escalate  — escalate to producer/user
conversationsRouter.post('/:id/escalate', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    const input  = escalateSchema.parse(req.body)
    res.json({ data: await escalateConversation(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// DELETE /api/conversations/:id/escalate  — remove escalation
conversationsRouter.delete('/:id/escalate', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    res.json({ data: await deescalateConversation(id, req.auth.orgId, req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/conversations/:id/takeover  — take ownership of conversation
conversationsRouter.post('/:id/takeover', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    const input  = takeoverSchema.parse(req.body)
    res.json({ data: await takeoverConversation(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// DELETE /api/conversations/:id/takeover  — release lock
conversationsRouter.delete('/:id/takeover', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = conversationIdParamSchema.parse(req.params)
    res.json({ data: await releaseConversationLock(id, req.auth.orgId, req.auth.userId) })
  } catch (err) { next(err) }
})
