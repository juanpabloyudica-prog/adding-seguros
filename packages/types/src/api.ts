// ─── Common API shapes ────────────────────────────────────────────────────────
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiResponse<T> {
  data: T
  meta?: Record<string, unknown>
}

// ─── Person API ───────────────────────────────────────────────────────────────
export interface CreatePersonRequest {
  full_name: string
  doc_type?: string
  doc_number?: string
  phone?: string
  email?: string
  birthdate?: string
  gender?: string
  address?: {
    street?: string
    city?: string
    province?: string
    zip?: string
    country?: string
  }
  is_company?: boolean
  tags?: string[]
  notes?: string
  producer_id?: string
  assigned_to_user_id?: string
}

export interface UpdatePersonRequest extends Partial<CreatePersonRequest> {}

export interface ListPersonsParams extends PaginationParams {
  search?: string
  producer_id?: string
  assigned_to_user_id?: string
  tags?: string
}

// ─── Policy API ───────────────────────────────────────────────────────────────
export interface CreatePolicyRequest {
  person_id: string
  company_id: string
  risk_id?: string
  quote_id?: string
  quote_option_id?: string
  producer_id?: string
  assigned_to_user_id?: string
  policy_number: string
  endorsement_number?: string
  ramo: string
  plan?: string
  start_date: string
  end_date: string
  premium?: number
  currency?: string
  payment_frequency?: string
  renewal_alert_days?: number
  auto_renew?: boolean
  notes?: string
}

export interface UpdatePolicyRequest extends Partial<Omit<CreatePolicyRequest, 'person_id'>> {
  status?: string
}

// ─── Case API ─────────────────────────────────────────────────────────────────
export interface CreateCaseRequest {
  person_id: string
  policy_id?: string
  producer_id?: string
  assigned_to_user_id?: string
  workflow_id?: string
  type: string
  priority?: string
  title: string
  description?: string
  due_date?: string
}

export interface UpdateCaseRequest extends Partial<Omit<CreateCaseRequest, 'person_id' | 'type'>> {
  status?: string
  current_step_key?: string
}

export interface TransitionCaseStepRequest {
  to_step_key: string
  notes?: string
}

export interface CloseCaseRequest {
  result: string
  result_type: string
  notes?: string
}

// ─── Conversation API ─────────────────────────────────────────────────────────
export interface SendMessageRequest {
  content: string
  type?: 'manual' | 'template' | 'internal'
  template_id?: string
  variables?: Record<string, string>
  is_internal_note?: boolean
}

export interface EscalateConversationRequest {
  escalated_to_user_id: string
  notes?: string
}

// ─── Quote API ────────────────────────────────────────────────────────────────
export interface CreateQuoteRequest {
  person_id: string
  risk_id: string
  producer_id?: string
  assigned_to_user_id?: string
  notes?: string
  internal_recommendation?: string
}

export interface AddQuoteOptionRequest {
  company_id: string
  plan_name: string
  coverage: Record<string, unknown>
  premium: number
  currency?: string
  payment_options?: Record<string, unknown>
  company_ranking?: number
  internal_notes?: string
  is_analyzed?: boolean
  is_sent_to_client?: boolean
  sort_order?: number
}

export interface SelectQuoteOptionRequest {
  option_id: string
  selection_reason?: string
}
