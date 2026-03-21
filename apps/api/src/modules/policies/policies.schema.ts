import { z } from 'zod'
import { POLICY_STATUSES, PAYMENT_FREQUENCIES, RENEWAL_STATUSES } from '@adding/types'

const uuidSchema = z.string().uuid()
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')

// ─── Create ───────────────────────────────────────────────────────────────────
export const createPolicySchema = z.object({
  person_id:           uuidSchema,
  company_id:          uuidSchema,
  producer_id:         uuidSchema.optional(),
  assigned_to_user_id: uuidSchema.optional(),
  risk_id:             uuidSchema.optional(),
  quote_id:            uuidSchema.optional(),
  quote_option_id:     uuidSchema.optional(),
  policy_number:       z.string().min(1).max(100).trim(),
  endorsement_number:  z.string().max(100).trim().optional(),
  ramo:                z.string().min(1).max(100).trim(),
  plan:                z.string().max(200).trim().optional(),
  start_date:          dateSchema,
  end_date:            dateSchema,
  premium:             z.number().positive().optional(),
  sum_insured:         z.number().positive().optional(),
  currency:            z.string().length(3).default('ARS'),
  payment_frequency:   z.enum(PAYMENT_FREQUENCIES).optional(),
  renewal_alert_days:  z.number().int().min(1).max(365).default(30),
  auto_renew:          z.boolean().default(false),
  coverage_summary:      z.union([z.string().max(2000), z.record(z.unknown())]).optional(),
  external_policy_number: z.string().max(100).trim().optional(),
  external_company_id:    z.string().max(100).trim().optional(),
  notes:               z.string().max(3000).optional(),
}).refine(
  (d) => new Date(d.end_date) > new Date(d.start_date),
  { message: 'end_date must be after start_date', path: ['end_date'] }
)

export type CreatePolicyInput = z.infer<typeof createPolicySchema>

// ─── Update ───────────────────────────────────────────────────────────────────
export const updatePolicySchema = z.object({
  producer_id:         uuidSchema.nullable().optional(),
  assigned_to_user_id: uuidSchema.nullable().optional(),
  policy_number:       z.string().min(1).max(100).trim().optional(),
  endorsement_number:  z.string().max(100).trim().nullable().optional(),
  ramo:                z.string().min(1).max(100).trim().optional(),
  plan:                z.string().max(200).trim().nullable().optional(),
  start_date:          dateSchema.optional(),
  end_date:            dateSchema.optional(),
  premium:             z.number().positive().nullable().optional(),
  sum_insured:         z.number().positive().nullable().optional(),
  currency:            z.string().length(3).optional(),
  payment_frequency:   z.enum(PAYMENT_FREQUENCIES).nullable().optional(),
  renewal_alert_days:  z.number().int().min(1).max(365).optional(),
  auto_renew:          z.boolean().optional(),
  coverage_summary:       z.union([z.string().max(2000), z.record(z.unknown())]).nullable().optional(),
  external_policy_number: z.string().max(100).trim().nullable().optional(),
  external_company_id:    z.string().max(100).trim().nullable().optional(),
  notes:               z.string().max(3000).nullable().optional(),
})

export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>

// ─── Status transition ────────────────────────────────────────────────────────
// Uses POLICY_STATUSES only (stored enum) — 'expiring' is computed, not stored.
export const updatePolicyStatusSchema = z.object({
  status:            z.enum(POLICY_STATUSES),
  cancellation_date: dateSchema.optional(),
  notes:             z.string().max(1000).optional(),
})

export type UpdatePolicyStatusInput = z.infer<typeof updatePolicyStatusSchema>

// ─── Renewal ──────────────────────────────────────────────────────────────────
// Renewing creates a NEW policy linked to the old one via renewed_from_id.
// The old policy's renewal_status is set to 'renewed'; status stays 'expired'.
export const renewPolicySchema = z.object({
  policy_number:      z.string().min(1).max(100).trim(),
  start_date:         dateSchema,
  end_date:           dateSchema,
  premium:            z.number().positive().optional(),
  sum_insured:        z.number().positive().optional(),
  payment_frequency:  z.enum(PAYMENT_FREQUENCIES).optional(),
  quote_id:           uuidSchema.optional(),
  quote_option_id:    uuidSchema.optional(),
  notes:              z.string().max(3000).optional(),
}).refine(
  (d) => new Date(d.end_date) > new Date(d.start_date),
  { message: 'end_date must be after start_date', path: ['end_date'] }
)

export type RenewPolicyInput = z.infer<typeof renewPolicySchema>

// ─── Renewal status ───────────────────────────────────────────────────────────
export const updateRenewalStatusSchema = z.object({
  renewal_status: z.enum(RENEWAL_STATUSES),
  notes:          z.string().max(1000).optional(),
})

export type UpdateRenewalStatusInput = z.infer<typeof updateRenewalStatusSchema>

// ─── List ─────────────────────────────────────────────────────────────────────
export const listPoliciesSchema = z.object({
  page:                z.coerce.number().int().min(1).default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(20),
  person_id:           uuidSchema.optional(),
  company_id:          uuidSchema.optional(),
  producer_id:         uuidSchema.optional(),
  assigned_to_user_id: uuidSchema.optional(),
  // Accepts stored values only; 'expiring' is handled via expiring_in_days
  status:              z.enum(POLICY_STATUSES).optional(),
  ramo:                z.string().max(100).optional(),
})

export type ListPoliciesInput = z.infer<typeof listPoliciesSchema>

// ─── Expiring endpoint params ─────────────────────────────────────────────────
export const expiringPoliciesSchema = z.object({
  days:        z.coerce.number().int().min(1).max(365).default(30),
  producer_id: uuidSchema.optional(),
})

export type ExpiringPoliciesInput = z.infer<typeof expiringPoliciesSchema>

export const policyIdParamSchema = z.object({ id: uuidSchema })

// ─── Dashboard summary ────────────────────────────────────────────────────────
// Optional producer_id filter scopes the summary to a single producer's cartera.
export const dashboardSummarySchema = z.object({
  producer_id: z.string().uuid().optional(),
})

export type DashboardSummaryInput = z.infer<typeof dashboardSummarySchema>

export interface PolicyDashboardSummary {
  total_active:       number
  total_expiring_30:  number
  total_expiring_15:  number
  total_expiring_7:   number
  total_expired:      number
  total_cancelled:    number
  total_renewed:      number
}
