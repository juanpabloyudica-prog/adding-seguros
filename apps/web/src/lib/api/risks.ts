import { apiGet } from './client'

export interface Risk {
  id:         string
  org_id:     string
  person_id:  string
  type:       string
  data:       Record<string, unknown>
  created_at: string
}

export async function getRisksByPerson(personId: string) {
  return apiGet<{ data: Risk[] }>(`/api/risks/by-person/${personId}`)
}
