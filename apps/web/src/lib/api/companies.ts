import { apiGet, apiPatch } from './client'

export interface Company {
  id:                  string
  org_id:              string
  name:                string
  short_name:          string | null
  logo_url:            string | null
  login_url:           string | null
  emision_url:         string | null
  siniestros_url:      string | null
  consulta_poliza_url: string | null
  multicotizador:      boolean
  ranking:             number | null
  notes:               string | null
  is_active:           boolean
  created_at:          string
  updated_at:          string
}

export interface CompanyDetail extends Company {
  metadata: {
    active_policy_count: number
    quote_option_count:  number
  }
}

export async function getCompanies(params?: { search?: string; is_active?: boolean }) {
  return apiGet<{ data: Company[] }>('/api/companies', {
    ...(params?.search    !== undefined ? { search:    params.search }                : {}),
    ...(params?.is_active !== undefined ? { is_active: String(params.is_active) }     : {}),
  })
}

export async function getCompany(id: string) {
  return apiGet<{ data: CompanyDetail }>(`/api/companies/${id}`)
}

export async function updateCompany(id: string, body: Partial<Omit<Company, 'id' | 'org_id' | 'created_at' | 'updated_at'>>) {
  return apiPatch<{ data: Company }>(`/api/companies/${id}`, body)
}
