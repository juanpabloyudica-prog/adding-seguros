import { apiGet, apiPatch } from './client'

export interface CurrentUser {
  id:             string
  org_id:         string
  full_name:      string
  email:          string
  role:           string
  phone:          string | null
  avatar_url:     string | null
  producer_id:    string | null
  signature_text: string | null
}

export interface OrgUser {
  id:          string
  full_name:   string
  email:       string
  role:        string
  avatar_url:  string | null
  is_active:   boolean
  producer_id: string | null
}

export async function getMe() {
  return apiGet<{ data: CurrentUser }>('/api/users/me')
}

export async function getUsers(params?: { role?: string; is_active?: boolean; search?: string }) {
  return apiGet<{ data: OrgUser[] }>('/api/users', params as Record<string, string>)
}

export async function updateUser(
  id: string,
  body: { is_active?: boolean; role?: string; full_name?: string; phone?: string | null }
) {
  return apiPatch<{ data: OrgUser }>(`/api/users/${id}`, body)
}
