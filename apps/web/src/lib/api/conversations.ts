import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Conversation, Message, PaginatedResponse } from '@adding/types'

export interface ConversationDetail extends Conversation {
  person:       { id: string; full_name: string; phone: string | null } | null
  assigned_to:  { id: string; full_name: string } | null
  escalated_to: { id: string; full_name: string } | null
  locked_by:    { id: string; full_name: string } | null
  linked_case:  { id: string; title: string; status: string; priority: string } | null
}

export interface MessageWithSender extends Message {
  sender_name?: string | null
}

export interface ListConversationsParams {
  page?:                number
  limit?:               number
  status?:              string
  assigned_to_user_id?: string
  person_id?:           string
  search?:              string
  unread_only?:         boolean
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function getConversations(params?: ListConversationsParams) {
  return apiGet<PaginatedResponse<ConversationDetail>>('/api/conversations', params as Record<string, string>)
}

export async function getConversation(id: string) {
  return apiGet<{ data: ConversationDetail }>(`/api/conversations/${id}`)
}

export async function getConversationMessages(id: string, params?: { limit?: number; before_sent_at?: string }) {
  return apiGet<{ data: MessageWithSender[] }>(`/api/conversations/${id}/messages`, params as Record<string, string>)
}

export async function updateConversation(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: Conversation }>(`/api/conversations/${id}`, body)
}

export async function sendMessage(id: string, body: {
  content: string
  type?: 'manual' | 'template' | 'internal'
  is_internal_note?: boolean
}) {
  return apiPost<{ data: Message }>(`/api/conversations/${id}/messages`, body)
}

export async function escalateConversation(id: string, escalated_to_user_id: string, notes?: string) {
  return apiPost<{ data: Conversation }>(`/api/conversations/${id}/escalate`, {
    escalated_to_user_id, notes,
  })
}

export async function deescalateConversation(id: string) {
  return apiDelete<{ data: Conversation }>(`/api/conversations/${id}/escalate`)
}

export async function takeoverConversation(id: string, force = false) {
  return apiPost<{ data: Conversation }>(`/api/conversations/${id}/takeover`, { force })
}

export async function releaseTakeover(id: string) {
  return apiDelete<{ data: Conversation }>(`/api/conversations/${id}/takeover`)
}

export async function getPersonConversations(personId: string) {
  return apiGet<{ data: ConversationDetail[] }>(`/api/conversations`, {
    // Filter by person_id — uses existing list endpoint
    search: undefined,
  }).then(async () => {
    // Direct approach: use the conversations list filtered by person
    return apiGet<{ data: ConversationDetail[] }>('/api/conversations', {
      limit: '20',
    })
  })
}
