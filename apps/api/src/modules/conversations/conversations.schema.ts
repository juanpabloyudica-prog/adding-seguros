import { z } from 'zod'
import { CONVERSATION_STATUSES } from '@adding/types'

const uuidSchema = z.string().uuid()

// ─── List ─────────────────────────────────────────────────────────────────────
export const listConversationsSchema = z.object({
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(30),
  status:              z.enum(CONVERSATION_STATUSES).optional(),
  assigned_to_user_id: uuidSchema.optional(),
  person_id:           uuidSchema.optional(),
  search:              z.string().max(200).optional(),
  unread_only:         z.enum(['true','false']).transform(v => v === 'true').optional(),
})
export type ListConversationsInput = z.infer<typeof listConversationsSchema>

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateConversationSchema = z.object({
  status:              z.enum(CONVERSATION_STATUSES).optional(),
  assigned_to_user_id: uuidSchema.nullable().optional(),
  person_id:           uuidSchema.nullable().optional(),
  case_id:             uuidSchema.nullable().optional(),
})
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>

// ─── Escalate ─────────────────────────────────────────────────────────────────
export const escalateSchema = z.object({
  escalated_to_user_id: uuidSchema,
  notes:                z.string().max(500).optional(),
})
export type EscalateInput = z.infer<typeof escalateSchema>

// ─── Takeover ─────────────────────────────────────────────────────────────────
// No body needed — the acting user becomes the lock holder
export const takeoverSchema = z.object({
  force: z.boolean().default(false), // force takeover even if locked by someone else
})
export type TakeoverInput = z.infer<typeof takeoverSchema>

// ─── Send message ─────────────────────────────────────────────────────────────
export const sendMessageSchema = z.object({
  content:          z.string().min(1).max(4000).trim(),
  type:             z.enum(['manual', 'template', 'internal']).default('manual'),
  is_internal_note: z.boolean().default(false),
  template_id:      uuidSchema.optional(),
  variables:        z.record(z.string()).optional(),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

// ─── Params ───────────────────────────────────────────────────────────────────
export const conversationIdParamSchema = z.object({ id: uuidSchema })

// ─── Messages list ────────────────────────────────────────────────────────────
export const listMessagesSchema = z.object({
  limit:          z.coerce.number().int().min(1).max(100).default(50),
  before_sent_at: z.string().datetime().optional(), // cursor-based pagination
})
export type ListMessagesInput = z.infer<typeof listMessagesSchema>
