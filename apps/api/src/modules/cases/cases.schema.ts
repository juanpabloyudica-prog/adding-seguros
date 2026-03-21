import { z } from 'zod'
import { CASE_TYPES, CASE_STATUSES, CASE_PRIORITIES, CASE_RESULT_TYPES } from '@adding/types'

const uuid = z.string().uuid()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

// ─── Create ───────────────────────────────────────────────────────────────────
export const createCaseSchema = z.object({
  person_id:           uuid,
  policy_id:           uuid.optional(),
  producer_id:         uuid.optional(),
  assigned_to_user_id: uuid.optional(),
  workflow_id:         uuid.optional(),
  type:                z.enum(CASE_TYPES),
  priority:            z.enum(CASE_PRIORITIES).default('medium'),
  title:               z.string().min(3).max(300).trim(),
  description:         z.string().max(5000).optional(),
  due_date:            date.optional(),
  required_documents:  z.array(z.string().max(100)).max(20).optional().default([]),
})
export type CreateCaseInput = z.infer<typeof createCaseSchema>

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateCaseSchema = z.object({
  producer_id:         uuid.nullable().optional(),
  assigned_to_user_id: uuid.nullable().optional(),
  escalated_to_user_id: uuid.nullable().optional(),
  priority:            z.enum(CASE_PRIORITIES).optional(),
  title:               z.string().min(3).max(300).trim().optional(),
  description:         z.string().max(5000).nullable().optional(),
  due_date:            date.nullable().optional(),
  required_documents:  z.array(z.string().max(100)).max(20).optional(),
  current_step_key:    z.string().max(100).optional(),
})
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>

// ─── Status transition ────────────────────────────────────────────────────────
export const transitionCaseStatusSchema = z.object({
  status: z.enum(CASE_STATUSES),
  notes:  z.string().max(1000).optional(),
})
export type TransitionCaseStatusInput = z.infer<typeof transitionCaseStatusSchema>

// ─── Workflow step transition ─────────────────────────────────────────────────
export const transitionStepSchema = z.object({
  to_step_key: z.string().max(100),
  notes:       z.string().max(1000).optional(),
})
export type TransitionStepInput = z.infer<typeof transitionStepSchema>

// ─── Close ────────────────────────────────────────────────────────────────────
export const closeCaseSchema = z.object({
  result:      z.string().min(1).max(2000),
  result_type: z.enum(CASE_RESULT_TYPES),
  notes:       z.string().max(1000).optional(),
})
export type CloseCaseInput = z.infer<typeof closeCaseSchema>

// ─── Add timeline note ────────────────────────────────────────────────────────
export const addTimelineNoteSchema = z.object({
  notes: z.string().min(1).max(3000),
})
export type AddTimelineNoteInput = z.infer<typeof addTimelineNoteSchema>

// ─── Link conversation ────────────────────────────────────────────────────────
export const linkConversationSchema = z.object({
  conversation_id: uuid,
})
export type LinkConversationInput = z.infer<typeof linkConversationSchema>

// ─── List ─────────────────────────────────────────────────────────────────────
export const listCasesSchema = z.object({
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(20),
  person_id:           uuid.optional(),
  policy_id:           uuid.optional(),
  producer_id:         uuid.optional(),
  assigned_to_user_id: uuid.optional(),
  type:                z.enum(CASE_TYPES).optional(),
  status:              z.enum(CASE_STATUSES).optional(),
  priority:            z.enum(CASE_PRIORITIES).optional(),
  search:              z.string().max(200).optional(),
  // Convenience filters
  open_only:           z.enum(['true','false']).transform(v => v === 'true').optional(),
  overdue_only:        z.enum(['true','false']).transform(v => v === 'true').optional(),
})
export type ListCasesInput = z.infer<typeof listCasesSchema>

export const caseIdParamSchema = z.object({ id: uuid })
