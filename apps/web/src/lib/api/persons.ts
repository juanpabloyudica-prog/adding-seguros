import { apiGet, apiPost, apiPatch, apiDelete } from './client'
import type { Person, PaginatedResponse } from '@adding/types'

export interface PersonDetail extends Person {
  producer: { id: string; full_name: string; specialties: string[] } | null
  assigned_to: { id: string; full_name: string; email: string; role: string } | null
  metadata: {
    policy_count:       number
    open_case_count:    number
    conversation_count: number
    document_count:     number
  }
}

export interface ListPersonsParams {
  page?:                number
  limit?:               number
  search?:              string
  producer_id?:         string
  assigned_to_user_id?: string
  is_company?:          boolean
  tags?:                string
}

export async function getPersons(params?: ListPersonsParams) {
  return apiGet<PaginatedResponse<Person>>('/api/persons', params as Record<string, string>)
}

export async function getPerson(id: string) {
  return apiGet<{ data: PersonDetail }>(`/api/persons/${id}`)
}

export async function createPerson(body: Record<string, unknown>, idempotencyKey?: string) {
  return apiPost<{ data: Person }>('/api/persons', body, idempotencyKey)
}

export async function updatePerson(id: string, body: Record<string, unknown>) {
  return apiPatch<{ data: Person }>(`/api/persons/${id}`, body)
}

export async function deletePerson(id: string) {
  return apiDelete<void>(`/api/persons/${id}`)
}
