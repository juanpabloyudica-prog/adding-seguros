import { apiGet, apiPost, apiPatch } from './client'
import type { Policy, PaginatedResponse } from '@adding/types'

export interface PolicyDashboardSummary {
  total_active:       number
  total_expiring_30:  number
  total_expiring_15:  number
  total_expiring_7:   number
  total_expired:      number
  total_cancelled:    number
  total_renewed:      number
}

export interface PolicyWithComputed extends Policy {
  computed_status: 'draft' | 'active' | 'expiring' | 'expired' | 'cancelled'
  days_until_expiry: number
  person:   { id: string; full_name: string; phone: string | null } | null
  company:  { id: string; name: string; short_name: string | null } | null
  producer: { id: string; full_name: string } | null
}

export async function getPoliciesDashboard(producerId?: string) {
  return apiGet<{ data: PolicyDashboardSummary }>(
    '/api/policies/dashboard-summary',
    producerId ? { producer_id: producerId } : undefined
  )
}

export async function getExpiringPolicies(days = 30, producerId?: string) {
  return apiGet<{ data: PolicyWithComputed[]; meta: { days: number; count: number } }>(
    '/api/policies/expiring',
    { days, ...(producerId ? { producer_id: producerId } : {}) }
  )
}

export async function getPolicies(params?: Record<string, string | number>) {
  return apiGet<PaginatedResponse<PolicyWithComputed>>('/api/policies', params)
}

export interface PolicyDetail extends PolicyWithComputed {
  risk: { id: string; type: string; data: Record<string, unknown> } | null
  assigned_to: { id: string; full_name: string } | null
  endorsement_number: string | null
  plan: string | null
  sum_insured: number | null
  payment_frequency: string | null
  renewal_alert_days: number
  auto_renew: boolean
  renewal_status: string | null
  renewed_from_id: string | null
  cancellation_date: string | null
  coverage_summary: Record<string, unknown> | null
  external_policy_number: string | null
  notes: string | null
}

export async function getPolicy(id: string) {
  return apiGet<{ data: PolicyDetail }>(`/api/policies/${id}`)
}

export async function updatePolicyStatus(
  id: string, status: string, cancellation_date?: string
) {
  return apiPatch<{ data: PolicyDetail }>(`/api/policies/${id}/status`, {
    status,
    ...(cancellation_date ? { cancellation_date } : {}),
  })
}

export async function renewPolicy(
  id: string, body: Record<string, unknown>, idempotencyKey: string
) {
  return apiPost<{ data: PolicyDetail }>(`/api/policies/${id}/renew`, body, idempotencyKey)
}

export async function updateRenewalStatus(id: string, renewal_status: string) {
  return apiPatch<{ data: PolicyDetail }>(`/api/policies/${id}/renewal-status`, { renewal_status })
}
