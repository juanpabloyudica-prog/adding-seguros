import { apiGet } from './client'

export interface ProducerListItem {
  id:         string
  user:       { id: string; full_name: string; email: string }
  is_active:  boolean
  specialties: string[]
}

export async function getProducers(params?: { search?: string; is_active?: boolean }) {
  return apiGet<{ data: ProducerListItem[] }>('/api/producers', {
    ...(params?.search    ? { search:    params.search }               : {}),
    ...(params?.is_active !== undefined ? { is_active: String(params.is_active) } : {}),
    limit: '100',
  })
}
