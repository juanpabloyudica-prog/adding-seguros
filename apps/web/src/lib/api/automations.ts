import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { PaginatedResponse } from '@adding/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Template {
  id: string; org_id: string; name: string; category: string | null
  type: string; body: string; variables: string[]; channel: string
  is_active: boolean; created_at: string; updated_at: string
}

export interface RuleDetail {
  id: string; org_id: string; name: string; template_id: string
  trigger_event: string; delay_hours: number; recurrence_days: number | null
  filter_producer_id: string | null; filter_company_id: string | null
  filter_ramo: string | null; cancel_on_events: string[]
  extra_conditions: Record<string, unknown>; is_active: boolean
  created_at: string; updated_at: string
  template: { id: string; name: string; body: string } | null
}

export interface ScheduledMessageDetail {
  id: string; org_id: string; conversation_id: string
  template_id: string; rule_id: string | null
  case_id: string | null; policy_id: string | null
  scheduled_for: string; status: string
  variables: Record<string, unknown>
  cancel_reason: string | null; cancelled_at: string | null
  attempts: number; max_attempts: number; last_error: string | null
  created_at: string
  template:     { name: string; body: string } | null
  rule:         { name: string } | null
  conversation: { wa_phone: string; wa_contact_name: string | null } | null
}

export interface ListScheduledParams {
  page?: number; limit?: number
  status?: string; rule_id?: string
  policy_id?: string; case_id?: string
  upcoming_only?: boolean
}

// ─── Templates ────────────────────────────────────────────────────────────────
export async function getTemplates() {
  return apiGet<{ data: Template[] }>('/api/automations/templates')
}
export async function getTemplate(id: string) {
  return apiGet<{ data: Template }>(`/api/automations/templates/${id}`)
}
export async function createTemplate(body: Record<string, unknown>) {
  return apiPost<{ data: Template }>('/api/automations/templates', body)
}
export async function updateTemplate(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: Template }>(`/api/automations/templates/${id}`, body)
}
export async function previewTemplate(id: string, variables: Record<string, string>, templateBody?: string) {
  return apiPost<{ data: { preview: string } }>(`/api/automations/templates/${id}/preview`, {
    body: templateBody, variables,
  })
}

// ─── Rules ────────────────────────────────────────────────────────────────────
export async function getRules() {
  return apiGet<{ data: RuleDetail[] }>('/api/automations/rules')
}
export async function getRule(id: string) {
  return apiGet<{ data: RuleDetail }>(`/api/automations/rules/${id}`)
}
export async function createRule(body: Record<string, unknown>) {
  return apiPost<{ data: RuleDetail }>('/api/automations/rules', body)
}
export async function updateRule(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: RuleDetail }>(`/api/automations/rules/${id}`, body)
}

// ─── Scheduled messages ───────────────────────────────────────────────────────
export async function getScheduledMessages(params?: ListScheduledParams) {
  return apiGet<PaginatedResponse<ScheduledMessageDetail>>('/api/automations/scheduled', params as Record<string, string>)
}
export async function cancelScheduledMessage(id: string, reason?: string) {
  // Using apiPost-style DELETE with body for reason
  return apiDelete<{ data: ScheduledMessageDetail }>(`/api/automations/scheduled/${id}`)
}

export async function cancelScheduledMessageWithReason(id: string, reason?: string) {
  // DELETE with JSON body — fetch directly since apiDelete doesn't support body
  const { apiFetch } = await import('./client')
  return apiFetch<{ data: ScheduledMessageDetail }>(`/api/automations/scheduled/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason: reason ?? 'Cancelado manualmente' }),
  })
}

// ─── Manual trigger ───────────────────────────────────────────────────────────
export async function triggerRule(body: {
  rule_id: string; conversation_id: string
  policy_id?: string; case_id?: string
  variables?: Record<string, string>; send_now?: boolean
}) {
  return apiPost<{
    data: {
      scheduled: unknown; scheduledFor: string; preview: string
    }
  }>('/api/automations/trigger', body)
}

// ─── Execution history ────────────────────────────────────────────────────────
export interface AutomationHistoryEntry {
  id:              string
  action:          string
  payload:         {
    template_id?:    string | null
    rule_id?:        string | null
    conversation_id?: string | null
    policy_id?:      string | null
    case_id?:        string | null
    is_manual?:      boolean
    triggered_by?:   string | null
    notes?:          string | null
  }
  created_at:      string
  conversation_id: string | null
  case_id:         string | null
}

export async function getAutomationHistory(params?: {
  page?: number; limit?: number; rule_id?: string; action?: string
}) {
  return apiGet<PaginatedResponse<AutomationHistoryEntry>>(
    '/api/automations/history', params as Record<string, string>
  )
}
