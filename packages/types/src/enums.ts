// ─── User roles ──────────────────────────────────────────────────────────────
export const USER_ROLES = ['admin', 'operativo', 'productor', 'supervisor', 'readonly'] as const
export type UserRole = typeof USER_ROLES[number]

// ─── Risk types ───────────────────────────────────────────────────────────────
export const RISK_TYPES = [
  'auto', 'moto', 'hogar', 'vida', 'accidentes',
  'comercial', 'transporte', 'responsabilidad', 'otros'
] as const
export type RiskType = typeof RISK_TYPES[number]

// ─── Quote status ─────────────────────────────────────────────────────────────
export const QUOTE_STATUSES = [
  'draft', 'options_loaded', 'sent_to_client', 'selected', 'emitted', 'lost'
] as const
export type QuoteStatus = typeof QUOTE_STATUSES[number]

// ─── Policy status ────────────────────────────────────────────────────────────
export const POLICY_STATUSES = [
  'draft', 'active', 'expired', 'cancelled'
] as const
export type PolicyStatus = typeof POLICY_STATUSES[number]

// expiring is a computed status returned by the API, not stored in the DB.
// Returned when status='active' AND end_date is within the renewal_alert_days window.
export type PolicyStatusComputed = PolicyStatus | 'expiring'

export const RENEWAL_STATUSES = ['pending', 'quoted', 'renewed', 'lost'] as const
export type RenewalStatus = typeof RENEWAL_STATUSES[number]

export const PAYMENT_FREQUENCIES = ['monthly', 'quarterly', 'semi_annual', 'annual'] as const
export type PaymentFrequency = typeof PAYMENT_FREQUENCIES[number]

// ─── Case types and statuses ──────────────────────────────────────────────────
export const CASE_TYPES = [
  'prospecto', 'recotizacion', 'incidencia',
  'siniestro', 'reclamo', 'consulta', 'endoso', 'otros'
] as const
export type CaseType = typeof CASE_TYPES[number]

export const CASE_STATUSES = [
  'open', 'in_progress', 'waiting_client', 'waiting_company',
  'escalated', 'resolved', 'closed', 'cancelled'
] as const
export type CaseStatus = typeof CASE_STATUSES[number]

export const CASE_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type CasePriority = typeof CASE_PRIORITIES[number]

export const CASE_RESULT_TYPES = ['ganado', 'perdido', 'resuelto', 'sin_resultado'] as const
export type CaseResultType = typeof CASE_RESULT_TYPES[number]

export const CASE_TIMELINE_ENTRY_TYPES = [
  'status_change', 'step_change', 'assignment', 'note',
  'document_added', 'message_sent', 'escalation', 'system_event'
] as const
export type CaseTimelineEntryType = typeof CASE_TIMELINE_ENTRY_TYPES[number]

// ─── Conversation statuses ────────────────────────────────────────────────────
export const CONVERSATION_STATUSES = [
  'open', 'waiting_operativo', 'waiting_productor',
  'escalated', 'resolved', 'closed'
] as const
export type ConversationStatus = typeof CONVERSATION_STATUSES[number]

// ─── Message types and statuses ───────────────────────────────────────────────
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = typeof MESSAGE_DIRECTIONS[number]

export const MESSAGE_TYPES = ['manual', 'automated', 'template', 'internal'] as const
export type MessageType = typeof MESSAGE_TYPES[number]

export const MESSAGE_STATUSES = ['pending', 'sent', 'delivered', 'read', 'failed'] as const
export type MessageStatus = typeof MESSAGE_STATUSES[number]

// ─── Template types ───────────────────────────────────────────────────────────
export const TEMPLATE_TYPES = ['onboarding', 'event', 'adhoc', 'recurring'] as const
export type TemplateType = typeof TEMPLATE_TYPES[number]

// ─── Scheduled message statuses ───────────────────────────────────────────────
export const SCHEDULED_MESSAGE_STATUSES = [
  'pending', 'processing', 'sent', 'cancelled', 'failed', 'overridden'
] as const
export type ScheduledMessageStatus = typeof SCHEDULED_MESSAGE_STATUSES[number]

// ─── Document entity types ────────────────────────────────────────────────────
export const DOCUMENT_ENTITY_TYPES = ['policy', 'case', 'quote', 'person'] as const
export type DocumentEntityType = typeof DOCUMENT_ENTITY_TYPES[number]

// ─── Doc types ────────────────────────────────────────────────────────────────
export const DOC_TYPES = ['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'otro'] as const
export type DocType = typeof DOC_TYPES[number]

// ─── Automation triggers ──────────────────────────────────────────────────────
export const TRIGGER_EVENTS = [
  'policy_expiring_30d',
  'policy_expiring_15d',
  'policy_expiring_7d',
  'case_created',
  'case_status_changed',
  'case_closed',
  'inbound_message_received',
  'quote_sent_to_client',
] as const
export type TriggerEvent = typeof TRIGGER_EVENTS[number]

export const TRIGGER_EVENT_LABELS: Record<TriggerEvent, string> = {
  policy_expiring_30d:     'Póliza por vencer (30 días)',
  policy_expiring_15d:     'Póliza por vencer (15 días)',
  policy_expiring_7d:      'Póliza por vencer (7 días)',
  case_created:            'Caso creado',
  case_status_changed:     'Caso cambió de estado',
  case_closed:             'Caso cerrado',
  inbound_message_received:'Mensaje entrante recibido',
  quote_sent_to_client:    'Cotización enviada al cliente',
}

// Actions a rule can take
export const AUTOMATION_ACTIONS = [
  'send_message',
  'create_case',
  'assign_user',
] as const
export type AutomationAction = typeof AUTOMATION_ACTIONS[number]

// Scheduled message statuses (already in DB, duplicated here for FE)
export const SCHEDULED_MESSAGE_STATUSES = [
  'pending', 'processing', 'sent', 'cancelled', 'failed', 'overridden',
] as const
export type ScheduledMessageStatus = typeof SCHEDULED_MESSAGE_STATUSES[number]

// Template types (from DB)
export const TEMPLATE_TYPES = ['onboarding', 'event', 'adhoc', 'recurring'] as const
export type TemplateType = typeof TEMPLATE_TYPES[number]
