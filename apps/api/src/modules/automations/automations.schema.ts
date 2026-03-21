import { z } from 'zod'
import { TRIGGER_EVENTS, TEMPLATE_TYPES } from '@adding/types'

const uuid = z.string().uuid()

// ─── Templates ────────────────────────────────────────────────────────────────
export const createTemplateSchema = z.object({
  name:     z.string().min(2).max(200).trim(),
  type:     z.enum(TEMPLATE_TYPES),
  category: z.string().max(100).optional(),
  body:     z.string().min(1).max(4000).trim(),
  channel:  z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
})
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>

export const updateTemplateSchema = z.object({
  name:      z.string().min(2).max(200).trim().optional(),
  type:      z.enum(TEMPLATE_TYPES).optional(),
  category:  z.string().max(100).nullable().optional(),
  body:      z.string().min(1).max(4000).trim().optional(),
  is_active: z.boolean().optional(),
})
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>

export const templateIdParamSchema = z.object({ id: uuid })

export const previewTemplateSchema = z.object({
  body:      z.string().min(1).max(4000).optional(),
  variables: z.record(z.string()),
})

// ─── Automation rules ─────────────────────────────────────────────────────────
export const createRuleSchema = z.object({
  name:              z.string().min(2).max(200).trim(),
  template_id:       uuid,
  trigger_event:     z.enum(TRIGGER_EVENTS),
  delay_hours:       z.number().int().min(0).max(720).default(0),
  recurrence_days:   z.number().int().min(1).max(365).nullable().optional(),
  filter_producer_id: uuid.nullable().optional(),
  filter_company_id:  uuid.nullable().optional(),
  filter_ramo:        z.string().max(100).nullable().optional(),
  cancel_on_events:   z.array(z.string().max(100)).default([]),
  extra_conditions:   z.record(z.unknown()).default({}),
})
export type CreateRuleInput = z.infer<typeof createRuleSchema>

export const updateRuleSchema = z.object({
  name:              z.string().min(2).max(200).trim().optional(),
  template_id:       uuid.optional(),
  trigger_event:     z.enum(TRIGGER_EVENTS).optional(),
  delay_hours:       z.number().int().min(0).max(720).optional(),
  recurrence_days:   z.number().int().min(1).max(365).nullable().optional(),
  filter_producer_id: uuid.nullable().optional(),
  filter_company_id:  uuid.nullable().optional(),
  filter_ramo:        z.string().max(100).nullable().optional(),
  cancel_on_events:   z.array(z.string().max(100)).optional(),
  extra_conditions:   z.record(z.unknown()).optional(),
  is_active:         z.boolean().optional(),
})
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>

export const ruleIdParamSchema = z.object({ id: uuid })

// ─── Scheduled messages ───────────────────────────────────────────────────────
export const listScheduledSchema = z.object({
  page:        z.coerce.number().int().min(1).default(1),
  limit:       z.coerce.number().int().min(1).max(100).default(20),
  status:      z.enum(['pending','processing','sent','cancelled','failed','overridden']).optional(),
  rule_id:     uuid.optional(),
  policy_id:   uuid.optional(),
  case_id:     uuid.optional(),
  upcoming_only: z.enum(['true','false']).transform(v => v === 'true').optional(),
})
export type ListScheduledInput = z.infer<typeof listScheduledSchema>

export const cancelScheduledSchema = z.object({
  reason: z.string().max(500).optional(),
})

export const scheduledIdParamSchema = z.object({ id: uuid })

// ─── Manual trigger ───────────────────────────────────────────────────────────
// Manually fire a rule for a specific entity (e.g. trigger renewal reminder now)
export const manualTriggerSchema = z.object({
  rule_id:         uuid,
  conversation_id: uuid,
  policy_id:       uuid.optional(),
  case_id:         uuid.optional(),
  variables:       z.record(z.string()).optional(),
  send_now:        z.boolean().default(false), // skip delay and send immediately
})
export type ManualTriggerInput = z.infer<typeof manualTriggerSchema>
