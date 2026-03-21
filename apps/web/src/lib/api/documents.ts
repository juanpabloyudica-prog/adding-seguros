import { apiGet, apiPost, apiFetch } from './client'

export interface Document {
  id:               string
  entity_type:      string
  entity_id:        string
  type:             string
  file_url:         string
  file_name:        string
  file_size:        number | null
  mime_type:        string | null
  is_public:        boolean
  created_at:       string
  uploaded_by_name: string | null
  entity_name:      string | null   // resolved entity display name
}

export interface QuotePdfData {
  quote: {
    id: string; status: string
    internal_recommendation: string | null
    selection_reason: string | null; sent_at: string | null
    person_name: string | null; person_phone: string | null; person_email: string | null
    person_doc_type: string | null; person_doc_number: string | null
    risk_type: string | null; risk_data: Record<string, unknown> | null
    producer_name: string | null; producer_signature: string | null
    org_name: string | null
  }
  options: {
    id: string; plan_name: string; premium: number; currency: string
    coverage: Record<string, unknown>; company_ranking: number | null
    is_sent_to_client: boolean; is_selected: boolean
    internal_notes: string | null; payment_options: Record<string, unknown> | null
    company_name: string | null; company_logo_url: string | null
  }[]
  options_for_client: QuotePdfData['options']
  selected_option:    QuotePdfData['options'][number] | null
  generated_at:       string
}

export interface ListDocumentsParams {
  entity_type?: string
  entity_id?:   string
  type?:        string
  search?:      string
  page?:        number
  limit?:       number
}

export async function getDocuments(params?: ListDocumentsParams) {
  return apiGet<import('@adding/types').PaginatedResponse<Document> | { data: Document[] }>('/api/documents', params as Record<string, string>)
}

export async function registerDocument(body: {
  entity_type: string; entity_id: string; type: string
  file_url: string; file_name: string; file_size?: number
  mime_type?: string | null; is_public?: boolean
}) {
  return apiPost<{ data: Document }>('/api/documents', body)
}

export async function getQuotePdfData(quoteId: string) {
  return apiGet<{ data: QuotePdfData }>(`/api/documents/quote/${quoteId}/pdf-data`)
}

/**
 * Gets a short-lived signed URL for a private storage document.
 * The backend uses the service-role key to generate the URL.
 * `expiresIn` is in seconds (default 3600 = 1 hour).
 */
export async function getSignedDocumentUrl(docId: string, expiresIn = 3600): Promise<string> {
  const res = await apiFetch<{ data: { signed_url: string; expires_at: string | null } }>(
    `/api/documents/${docId}/signed-url`,
    {
      method: 'POST',
      body: JSON.stringify({}),
      params: { expires_in: String(expiresIn) },
    }
  )
  return res.data.signed_url
}
