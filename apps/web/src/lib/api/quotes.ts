import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Quote, QuoteOption, PaginatedResponse } from '@adding/types'

// ─── Extended shapes ──────────────────────────────────────────────────────────

export interface QuoteOptionWithCompany extends QuoteOption {
  is_selected: boolean
  company: {
    id: string
    name: string
    short_name: string | null
    logo_url: string | null
  } | null
}

export interface QuoteDetail extends Quote {
  person:   { id: string; full_name: string; phone: string | null } | null
  risk:     { id: string; type: string; data: Record<string, unknown> } | null
  producer: { id: string; full_name: string } | null
  options:  QuoteOptionWithCompany[]
}

export interface QuoteListItem extends Quote {
  person:     { id: string; full_name: string } | null
  producer:   { id: string; full_name: string } | null
  option_count?: number
  sent_count?:   number
}

export interface ListQuotesParams {
  page?:        number
  limit?:       number
  person_id?:   string
  status?:      string
  producer_id?: string
  search?:      string
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getQuotes(params?: ListQuotesParams) {
  return apiGet<PaginatedResponse<QuoteListItem>>('/api/quotes', params as Record<string, string>)
}

export async function getQuote(id: string) {
  return apiGet<{ data: QuoteDetail }>(`/api/quotes/${id}`)
}

export async function createQuote(body: Record<string, unknown>, idempotencyKey?: string) {
  return apiPost<{ data: Quote }>('/api/quotes', body, idempotencyKey)
}

export async function updateQuote(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: Quote }>(`/api/quotes/${id}`, body)
}

export async function addQuoteOption(id: string, body: Record<string, unknown>) {
  return apiPost<{ data: QuoteOption }>(`/api/quotes/${id}/options`, body)
}

export async function updateQuoteOption(id: string, optionId: string, body: Record<string, unknown>) {
  return apiPatch<{ data: QuoteOption }>(`/api/quotes/${id}/options/${optionId}`, body)
}

export async function deleteQuoteOption(id: string, optionId: string) {
  return apiDelete<void>(`/api/quotes/${id}/options/${optionId}`)
}

export async function markQuoteAsSent(id: string, option_ids: string[], commercial_pdf_url?: string) {
  return apiPost<{ data: Quote }>(`/api/quotes/${id}/mark-sent`, {
    option_ids,
    commercial_pdf_url,
  })
}

export async function selectQuoteOption(id: string, option_id: string, selection_reason?: string) {
  return apiPost<{ data: Quote }>(`/api/quotes/${id}/select-option`, {
    option_id,
    selection_reason,
  })
}
