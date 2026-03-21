import { z } from 'zod'
import { QUOTE_STATUSES } from '@adding/types'

const uuid = z.string().uuid()

// ─── Create quote ─────────────────────────────────────────────────────────────
export const createQuoteSchema = z.object({
  person_id:              uuid,
  risk_id:                uuid,
  producer_id:            uuid.optional(),
  assigned_to_user_id:    uuid.optional(),
  internal_recommendation: z.string().max(2000).optional(),
  notes:                  z.string().max(3000).optional(),
})
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>

// ─── Update quote ─────────────────────────────────────────────────────────────
export const updateQuoteSchema = z.object({
  producer_id:             uuid.nullable().optional(),
  assigned_to_user_id:     uuid.nullable().optional(),
  internal_recommendation: z.string().max(2000).nullable().optional(),
  notes:                   z.string().max(3000).nullable().optional(),
  lost_reason:             z.string().max(1000).nullable().optional(),
})
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>

// ─── Add option ───────────────────────────────────────────────────────────────
export const addQuoteOptionSchema = z.object({
  company_id:        uuid,
  plan_name:         z.string().min(1).max(200).trim(),
  coverage:          z.record(z.unknown()).default({}),
  premium:           z.number().positive(),
  currency:          z.string().length(3).default('ARS'),
  payment_options:   z.record(z.unknown()).optional(),
  company_ranking:   z.number().int().min(1).max(5).optional(),
  internal_notes:    z.string().max(1000).optional(),
  is_analyzed:       z.boolean().default(true),
  is_sent_to_client: z.boolean().default(false),
  sort_order:        z.number().int().default(0),
})
export type AddQuoteOptionInput = z.infer<typeof addQuoteOptionSchema>

// ─── Update option ────────────────────────────────────────────────────────────
export const updateQuoteOptionSchema = z.object({
  plan_name:         z.string().max(200).trim().optional(),
  coverage:          z.record(z.unknown()).optional(),
  premium:           z.number().positive().optional(),
  payment_options:   z.record(z.unknown()).nullable().optional(),
  company_ranking:   z.number().int().min(1).max(5).nullable().optional(),
  internal_notes:    z.string().max(1000).nullable().optional(),
  is_analyzed:       z.boolean().optional(),
  is_sent_to_client: z.boolean().optional(),
  sort_order:        z.number().int().optional(),
})
export type UpdateQuoteOptionInput = z.infer<typeof updateQuoteOptionSchema>

// ─── Select option (client chose this) ────────────────────────────────────────
export const selectOptionSchema = z.object({
  option_id:        uuid,
  selection_reason: z.string().max(1000).optional(),
})
export type SelectOptionInput = z.infer<typeof selectOptionSchema>

// ─── Mark as sent to client ───────────────────────────────────────────────────
export const markSentSchema = z.object({
  option_ids:            z.array(uuid).min(1), // which options were included in the PDF sent
  commercial_pdf_url:    z.string().url().optional(),
})
export type MarkSentInput = z.infer<typeof markSentSchema>

// ─── List ─────────────────────────────────────────────────────────────────────
export const listQuotesSchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  person_id: uuid.optional(),
  status:    z.enum(QUOTE_STATUSES).optional(),
  producer_id: uuid.optional(),
  search:    z.string().max(200).optional(),
})
export type ListQuotesInput = z.infer<typeof listQuotesSchema>

export const quoteIdParamSchema   = z.object({ id: uuid })
export const optionIdParamSchema  = z.object({ id: uuid, optionId: uuid })
