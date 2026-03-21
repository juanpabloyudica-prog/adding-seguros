import { apiGet, apiPost, apiPatch } from './client'
import type { Case, CaseTimelineEntry, PaginatedResponse } from '@adding/types'

export interface CaseWorkflowStep {
  key:                 string
  label:               string
  step_order:          number
  allowed_transitions: string[]
}

export interface CaseDetail extends Case {
  person:       { id: string; full_name: string; phone: string | null } | null
  policy:       { id: string; policy_number: string; ramo: string; status: string } | null
  producer:     { id: string; full_name: string } | null
  assigned_to:  { id: string; full_name: string } | null
  escalated_to: { id: string; full_name: string } | null
  workflow: {
    id: string; name: string
    steps: CaseWorkflowStep[]
  } | null
  timeline: (CaseTimelineEntry & { performer?: { id: string; full_name: string } | null })[]
  is_overdue?:          boolean
  conversation_count?:        number
  unread_conversation_count?: number
  document_count?:     number
}

export interface ListCasesParams {
  page?:                number
  limit?:               number
  person_id?:           string
  policy_id?:           string
  producer_id?:         string
  assigned_to_user_id?: string
  type?:                string
  status?:              string
  priority?:            string
  search?:              string
  open_only?:           boolean
  overdue_only?:        boolean
}

export async function getCases(params?: ListCasesParams) {
  return apiGet<PaginatedResponse<CaseDetail>>('/api/cases', params as Record<string, string>)
}

export async function getCase(id: string) {
  return apiGet<{ data: CaseDetail }>(`/api/cases/${id}`)
}

export async function createCase(body: Record<string, unknown>, idempotencyKey?: string) {
  return apiPost<{ data: Case }>('/api/cases', body, idempotencyKey)
}

export async function updateCase(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: Case }>(`/api/cases/${id}`, body)
}

export async function transitionCaseStatus(id: string, status: string, notes?: string) {
  return apiPatch<{ data: Case }>(`/api/cases/${id}/status`, { status, notes })
}

export async function transitionCaseStep(id: string, to_step_key: string, notes?: string) {
  return apiPatch<{ data: Case }>(`/api/cases/${id}/step`, { to_step_key, notes })
}

export async function closeCase(id: string, body: { result: string; result_type: string; notes?: string }) {
  return apiPost<{ data: Case }>(`/api/cases/${id}/close`, body)
}

export async function addCaseNote(id: string, notes: string) {
  return apiPost<{ data: CaseTimelineEntry }>(`/api/cases/${id}/timeline/notes`, { notes })
}

export async function linkCaseConversation(id: string, conversation_id: string) {
  return apiPost<void>(`/api/cases/${id}/link-conversation`, { conversation_id })
}

export interface CaseLinkedConversation {
  id:                string
  wa_phone:          string
  wa_contact_name:   string | null
  status:            string
  unread_count:      number
  last_message_at:   string | null
  last_message_text: string | null
}

export interface CaseDocument {
  id:               string
  type:             string
  file_name:        string
  file_url:         string
  file_size:        number | null
  mime_type:        string | null
  created_at:       string
  uploaded_by_name: string | null
}

export async function getCaseConversations(id: string) {
  return apiGet<{ data: CaseLinkedConversation[] }>(`/api/cases/${id}/conversations`)
}

export async function getCaseDocuments(id: string) {
  return apiGet<{ data: CaseDocument[] }>(`/api/cases/${id}/documents`)
}
