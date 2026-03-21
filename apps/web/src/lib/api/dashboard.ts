import { apiGet } from './client'

export interface MyDaySummary {
  unread_conversations: number
  overdue_cases:        number
  expiring_policies:    number
  scheduled_today:      number
  pending_quotes:       number
  failed_messages:      number
}

export interface UnreadConversation {
  id: string; wa_phone: string; wa_contact_name: string | null
  unread_count: number; status: string
  last_message_at: string | null; last_message_text: string | null
  person_name: string | null; assigned_to_name: string | null
}

export interface OverdueCase {
  id: string; title: string; type: string; priority: string; status: string
  due_date: string; days_overdue: number
  person_name: string | null; assigned_to_name: string | null
}

export interface ExpiringPolicy {
  id: string; ramo: string; end_date: string; days_until_expiry: number
  person_name: string | null; person_phone: string | null
  company_name: string | null; producer_name: string | null
  renewal_status: string | null
}

export interface ScheduledToday {
  id: string; scheduled_for: string; status: string
  wa_phone: string | null; template_name: string | null
  rule_name: string | null; case_id: string | null; policy_id: string | null
}

export interface PendingQuote {
  id: string; status: string; sent_at: string | null; days_waiting: number
  person_name: string | null; producer_name: string | null; option_count: number
}

export interface FailedMessage {
  id: string; scheduled_for: string; last_error: string | null
  attempts: number; template_name: string | null
  rule_name: string | null; wa_phone: string | null
}

export interface MyDayData {
  summary:              MyDaySummary
  unread_conversations: UnreadConversation[]
  overdue_cases:        OverdueCase[]
  expiring_policies:    ExpiringPolicy[]
  scheduled_today:      ScheduledToday[]
  pending_quotes:       PendingQuote[]
  failed_messages:      FailedMessage[]
}

export async function getMyDay(assignedToMe = false) {
  return apiGet<{ data: MyDayData }>(
    '/api/dashboard/my-day',
    assignedToMe ? { assigned_to_me: 'true' } : undefined
  )
}
