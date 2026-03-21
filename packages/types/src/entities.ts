import type {
  UserRole, RiskType, QuoteStatus, PolicyStatus, PolicyStatusComputed,
  RenewalStatus, PaymentFrequency,
  CaseType, CaseStatus, CasePriority, CaseResultType, CaseTimelineEntryType,
  ConversationStatus, MessageDirection, MessageType, MessageStatus,
  TemplateType, ScheduledMessageStatus, DocumentEntityType, DocType
} from './enums.js'

// ─── Base ─────────────────────────────────────────────────────────────────────
export interface BaseEntity {
  id: string
  org_id: string
  created_at: string
  updated_at: string
}

export interface MutableEntity extends BaseEntity {
  created_by: string
  updated_by: string
}

// ─── Organization ─────────────────────────────────────────────────────────────
export interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, unknown>
  plan: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  org_id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// ─── Producer ─────────────────────────────────────────────────────────────────
export interface Producer extends MutableEntity {
  user_id: string
  license_number: string | null
  specialties: string[]
  signature_text: string | null
  bio: string | null
  is_active: boolean
  // Joined
  user?: User
}

// ─── Person ───────────────────────────────────────────────────────────────────
export interface Address {
  street?: string
  city?: string
  province?: string
  zip?: string
  country?: string
}

export interface Person extends MutableEntity {
  producer_id: string | null
  assigned_to_user_id: string | null
  full_name: string
  doc_type: DocType | null
  doc_number: string | null
  phone: string | null
  email: string | null
  birthdate: string | null
  gender: string | null
  address: Address | null
  is_company: boolean
  tags: string[]
  notes: string | null
  // Joined
  producer?: Producer
  assigned_to?: User
}

// ─── Company ──────────────────────────────────────────────────────────────────
export interface Company extends MutableEntity {
  name: string
  short_name: string | null
  logo_url: string | null
  login_url: string | null
  emision_url: string | null
  siniestros_url: string | null
  consulta_poliza_url: string | null
  multicotizador: boolean
  ranking: number | null
  notes: string | null
  is_active: boolean
}

// ─── Risk ─────────────────────────────────────────────────────────────────────
export interface Risk extends MutableEntity {
  person_id: string
  type: RiskType
  data: Record<string, unknown>
  description: string | null
}

// ─── Quote ────────────────────────────────────────────────────────────────────
export interface Quote extends MutableEntity {
  person_id: string
  risk_id: string
  producer_id: string | null
  assigned_to_user_id: string | null
  status: QuoteStatus
  internal_recommendation: string | null
  source_pdf_url: string | null
  commercial_pdf_url: string | null
  selected_option_id: string | null
  selection_reason: string | null
  sent_at: string | null
  lost_reason: string | null
  notes: string | null
  // Joined
  options?: QuoteOption[]
}

export interface QuoteOption {
  id: string
  quote_id: string
  company_id: string
  plan_name: string
  coverage: Record<string, unknown>
  premium: number
  currency: string
  payment_options: Record<string, unknown> | null
  company_ranking: number | null
  internal_notes: string | null
  is_analyzed: boolean
  is_sent_to_client: boolean
  is_selected: boolean
  sort_order: number
  created_at: string
  // Joined
  company?: Company
}

// ─── Policy ───────────────────────────────────────────────────────────────────
export interface Policy extends MutableEntity {
  person_id: string
  company_id: string
  producer_id: string | null
  assigned_to_user_id: string | null
  risk_id: string | null
  quote_id: string | null
  quote_option_id: string | null
  renewed_from_id: string | null
  policy_number: string
  endorsement_number: string | null
  ramo: string
  plan: string | null
  start_date: string
  end_date: string
  premium: number | null
  sum_insured: number | null
  currency: string
  payment_frequency: PaymentFrequency | null
  status: PolicyStatus
  renewal_alert_days: number
  auto_renew: boolean
  renewal_status: RenewalStatus | null
  cancellation_date: string | null
  coverage_summary: Record<string, unknown> | string | null
  external_policy_number: string | null
  external_company_id: string | null
  notes: string | null
  // Joined
  person?: Person
  company?: Company
  producer?: Producer
}

// ─── Case workflow ────────────────────────────────────────────────────────────
export interface CaseWorkflow extends MutableEntity {
  name: string
  case_type: CaseType
  is_default: boolean
  is_active: boolean
  steps?: CaseWorkflowStep[]
}

export interface CaseWorkflowStep {
  id: string
  workflow_id: string
  key: string
  label: string
  step_order: number
  required_fields: string[]
  allowed_transitions: string[]
  auto_trigger_event: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Case ─────────────────────────────────────────────────────────────────────
export interface Case extends MutableEntity {
  person_id: string
  policy_id: string | null
  producer_id: string | null
  assigned_to_user_id: string | null
  escalated_to_user_id: string | null
  workflow_id: string | null
  current_step_key: string | null
  type: CaseType
  status: CaseStatus
  priority: CasePriority
  title: string
  description: string | null
  due_date: string | null
  required_documents: string[]
  result: string | null
  result_type: CaseResultType | null
  closed_at: string | null
  // Joined
  person?: Person
  policy?: Policy
  timeline?: CaseTimelineEntry[]
}

export interface CaseTimelineEntry {
  id: string
  case_id: string
  type: CaseTimelineEntryType
  from_value: string | null
  to_value: string | null
  notes: string | null
  performed_by: string | null
  created_at: string
  // Joined
  performer?: User
}

// ─── Conversation ─────────────────────────────────────────────────────────────
export interface Conversation extends MutableEntity {
  person_id: string | null
  case_id: string | null
  producer_id: string | null
  assigned_to_user_id: string | null
  escalated_to_user_id: string | null
  locked_by_user_id: string | null
  locked_at: string | null
  wa_phone: string
  wa_contact_name: string | null
  channel: string
  status: ConversationStatus
  unread_count: number
  last_message_at: string | null
  last_message_text: string | null
  metadata: Record<string, unknown>
  // Joined
  person?: Person
  assigned_to?: User
  messages?: Message[]
}

// ─── Message ──────────────────────────────────────────────────────────────────
export interface Message {
  id: string
  org_id: string
  conversation_id: string
  sent_by_user_id: string | null
  created_by: string | null
  direction: MessageDirection
  type: MessageType
  content: string | null
  payload: Record<string, unknown>
  media_url: string | null
  media_type: string | null
  wa_message_id: string | null
  status: MessageStatus
  error_detail: string | null
  signature_used: string | null
  template_id: string | null
  is_internal_note: boolean
  sent_at: string
  // Joined
  sender?: User
}

// ─── Template ─────────────────────────────────────────────────────────────────
export interface MessageTemplate extends MutableEntity {
  name: string
  category: string | null
  type: TemplateType
  body: string
  variables: string[]
  channel: string
  is_active: boolean
}

// ─── Automation rule ──────────────────────────────────────────────────────────
export interface AutomationRule extends MutableEntity {
  template_id: string
  name: string
  trigger_event: string
  delay_hours: number
  recurrence_days: number | null
  filter_producer_id: string | null
  filter_company_id: string | null
  filter_ramo: string | null
  filter_policy_type: string | null
  extra_conditions: Record<string, unknown>
  cancel_on_events: string[]
  is_active: boolean
}

// ─── Scheduled message ────────────────────────────────────────────────────────
export interface ScheduledMessage {
  id: string
  org_id: string
  conversation_id: string
  template_id: string
  rule_id: string | null
  case_id: string | null
  policy_id: string | null
  quote_id: string | null
  idempotency_key: string
  scheduled_for: string
  status: ScheduledMessageStatus
  variables: Record<string, string>
  cancel_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  override_by: string | null
  override_notes: string | null
  locked_until: string | null
  attempts: number
  max_attempts: number
  last_attempted_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

// ─── Document ─────────────────────────────────────────────────────────────────
export interface Document {
  id: string
  org_id: string
  entity_type: DocumentEntityType
  entity_id: string
  type: string
  file_url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  is_public: boolean
  uploaded_by: string
  created_at: string
}

// ─── Event (audit) ────────────────────────────────────────────────────────────
export interface AuditEvent {
  id: string
  org_id: string
  user_id: string | null
  entity_type: string
  entity_id: string
  action: string
  payload: Record<string, unknown>
  conversation_id: string | null
  case_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}
