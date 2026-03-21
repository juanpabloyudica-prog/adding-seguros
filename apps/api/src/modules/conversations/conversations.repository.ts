import { queryOne, queryMany, query } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Conversation, Message } from '@adding/types'
import type {
  ListConversationsInput, UpdateConversationInput,
  SendMessageInput, ListMessagesInput,
} from './conversations.schema.js'

// ─── Detail shape ─────────────────────────────────────────────────────────────
export interface ConversationDetail extends Conversation {
  person:       { id: string; full_name: string; phone: string | null } | null
  assigned_to:  { id: string; full_name: string } | null
  escalated_to: { id: string; full_name: string } | null
  locked_by:    { id: string; full_name: string } | null
}

// ─── Shared SELECT/JOIN fragments ─────────────────────────────────────────────
const CONV_SELECT = `
  c.*,
  CASE WHEN p.id IS NOT NULL THEN
    json_build_object('id', p.id, 'full_name', p.full_name, 'phone', p.phone)
  END AS person,
  CASE WHEN ua.id IS NOT NULL THEN
    json_build_object('id', ua.id, 'full_name', ua.full_name)
  END AS assigned_to,
  CASE WHEN ue.id IS NOT NULL THEN
    json_build_object('id', ue.id, 'full_name', ue.full_name)
  END AS escalated_to,
  CASE WHEN ul.id IS NOT NULL THEN
    json_build_object('id', ul.id, 'full_name', ul.full_name)
  END AS locked_by,
  CASE WHEN ca.id IS NOT NULL THEN
    json_build_object(
      'id',     ca.id,
      'title',  ca.title,
      'status', ca.status,
      'priority', ca.priority
    )
  END AS linked_case
`

const CONV_JOINS = `
  LEFT JOIN persons p  ON p.id  = c.person_id
  LEFT JOIN users ua   ON ua.id = c.assigned_to_user_id
  LEFT JOIN users ue   ON ue.id = c.escalated_to_user_id
  LEFT JOIN users ul   ON ul.id = c.locked_by_user_id
  LEFT JOIN cases ca   ON ca.id = c.case_id
`

// ─── findConversationById ─────────────────────────────────────────────────────
export async function findConversationById(
  id: string, orgId: string
): Promise<ConversationDetail | null> {
  return queryOne<ConversationDetail>(
    `SELECT ${CONV_SELECT} FROM conversations c ${CONV_JOINS}
     WHERE c.id = $1 AND c.org_id = $2 LIMIT 1`,
    [id, orgId]
  )
}

// ─── listConversations ────────────────────────────────────────────────────────
export async function listConversations(orgId: string, params: ListConversationsInput) {
  const { page, limit, status, assigned_to_user_id, person_id, search, unread_only } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['c.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (status) {
    conditions.push(`c.status = $${idx}`)
    values.push(status); idx++
  }
  if (assigned_to_user_id) {
    conditions.push(`c.assigned_to_user_id = $${idx}`)
    values.push(assigned_to_user_id); idx++
  }
  if (person_id) {
    conditions.push(`c.person_id = $${idx}`)
    values.push(person_id); idx++
  }
  if (search) {
    conditions.push(`(c.wa_phone ILIKE $${idx} OR c.wa_contact_name ILIKE $${idx} OR p.full_name ILIKE $${idx})`)
    values.push(`%${search}%`); idx++
  }
  if (unread_only) {
    conditions.push(`c.unread_count > 0`)
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM conversations c ${CONV_JOINS} WHERE ${whereClause}`, values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<ConversationDetail>(
    `SELECT ${CONV_SELECT}
     FROM conversations c ${CONV_JOINS}
     WHERE ${whereClause}
     ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── updateConversation ───────────────────────────────────────────────────────
export async function updateConversation(
  id: string, orgId: string,
  input: UpdateConversationInput,
  updatedBy: string
): Promise<Conversation | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[]    = [id, orgId, updatedBy]
  let idx = 4

  const fields: (keyof UpdateConversationInput)[] = [
    'status', 'assigned_to_user_id', 'person_id', 'case_id',
  ]
  for (const field of fields) {
    if (input[field] !== undefined) {
      setClauses.push(`${field} = $${idx}`)
      values.push(input[field]); idx++
    }
  }

  // When resolving or closing, zero out the unread count
  if (input.status === 'resolved' || input.status === 'closed') {
    setClauses.push('unread_count = 0')
  }

  return queryOne<Conversation>(
    `UPDATE conversations SET ${setClauses.join(', ')}
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}

// ─── setEscalation ────────────────────────────────────────────────────────────
export async function setEscalation(
  id: string, orgId: string,
  escalatedToUserId: string | null,
  updatedBy: string
): Promise<Conversation | null> {
  const newStatus = escalatedToUserId ? 'escalated' : 'open'
  return queryOne<Conversation>(
    `UPDATE conversations
     SET escalated_to_user_id = $3,
         status               = $4,
         updated_by           = $5,
         updated_at           = now()
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    [id, orgId, escalatedToUserId, newStatus, updatedBy]
  )
}

// ─── takeover ─────────────────────────────────────────────────────────────────
export async function takeover(
  id: string, orgId: string,
  userId: string, force: boolean
): Promise<{ success: boolean; lockedBy?: string }> {
  // Check current lock state
  const current = await queryOne<{ locked_by_user_id: string | null; locked_at: string | null }>(
    `SELECT locked_by_user_id, locked_at FROM conversations
     WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [id, orgId]
  )

  if (!current) return { success: false }

  // Already locked by someone else and not forced
  if (current.locked_by_user_id && current.locked_by_user_id !== userId && !force) {
    return { success: false, lockedBy: current.locked_by_user_id }
  }

  await query(
    `UPDATE conversations
     SET locked_by_user_id  = $3,
         locked_at          = now(),
         assigned_to_user_id = $3,
         updated_by         = $3,
         updated_at         = now()
     WHERE id = $1 AND org_id = $2`,
    [id, orgId, userId]
  )
  return { success: true }
}

// ─── releaseLock ──────────────────────────────────────────────────────────────
export async function releaseLock(
  id: string, orgId: string, userId: string
): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `UPDATE conversations
     SET locked_by_user_id = NULL,
         locked_at         = NULL,
         updated_by        = $3,
         updated_at        = now()
     WHERE id = $1 AND org_id = $2
       AND (locked_by_user_id = $3 OR $3 IN (
         SELECT id FROM users WHERE id = $3 AND role IN ('admin','supervisor')
       ))
     RETURNING id`,
    [id, orgId, userId]
  )
  return result !== null
}

// ─── markAsRead ───────────────────────────────────────────────────────────────
// Zeros unread_count on the conversation AND marks inbound messages as 'read'.
// Called automatically when the thread is opened.
export async function markAsRead(id: string, orgId: string): Promise<void> {
  await query(
    `UPDATE conversations SET unread_count = 0, updated_at = now()
     WHERE id = $1 AND org_id = $2`,
    [id, orgId]
  )
  // Mark unread inbound messages as read so WA delivery status is accurate
  await query(
    `UPDATE messages
     SET status = 'read'
     WHERE conversation_id = $1
       AND org_id = $2
       AND direction = 'inbound'
       AND status != 'read'`,
    [id, orgId]
  )
}

// ─── insertMessage ────────────────────────────────────────────────────────────
export async function insertMessage(
  orgId: string,
  conversationId: string,
  userId: string,
  input: SendMessageInput,
  signatureText?: string
): Promise<Message> {
  const isInternal = input.is_internal_note || input.type === 'internal'

  const msg = await queryOne<Message>(
    `INSERT INTO messages
       (org_id, conversation_id, sent_by_user_id, created_by,
        direction, type, content, is_internal_note, signature_used, template_id)
     VALUES ($1, $2, $3, $3, 'outbound', $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      orgId,
      conversationId,
      userId,
      isInternal ? 'internal' : input.type,
      input.content,
      isInternal,
      isInternal ? null : (signatureText ?? null),
      input.template_id ?? null,
    ]
  )
  if (!msg) throw new AppError('MESSAGE_INSERT_FAILED', 'Message insert returned no row', 500)

  // Update conversation's last_message fields (only for external messages)
  if (!isInternal) {
    await query(
      `UPDATE conversations
       SET last_message_at   = now(),
           last_message_text = $3,
           unread_count      = 0,
           updated_at        = now()
       WHERE id = $1 AND org_id = $2`,
      [conversationId, orgId, input.content.slice(0, 120)]
    )
  }

  return msg
}

// ─── updateMessageStatus ─────────────────────────────────────────────────────
// Called after Wasender confirms delivery
export async function updateMessageStatus(
  waMessageId: string,
  status: string,
  errorDetail?: string
): Promise<void> {
  await query(
    `UPDATE messages
     SET status = $2, error_detail = $3
     WHERE wa_message_id = $1`,
    [waMessageId, status, errorDetail ?? null]
  )
}

// ─── listMessages ─────────────────────────────────────────────────────────────
export async function listMessages(
  conversationId: string, orgId: string,
  params: ListMessagesInput
): Promise<Message[]> {
  const { limit, before_sent_at } = params
  const conditions = [
    'm.conversation_id = $1',
    'm.org_id = $2',
  ]
  const values: unknown[] = [conversationId, orgId]
  let idx = 3

  if (before_sent_at) {
    conditions.push(`m.sent_at < $${idx}`)
    values.push(before_sent_at); idx++
  }

  const rows = await queryMany<Message & { sender_name: string | null }>(
    `SELECT m.*,
       CASE WHEN u.id IS NOT NULL THEN u.full_name END AS sender_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.sent_by_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.sent_at DESC
     LIMIT $${idx}`,
    [...values, limit]
  )

  // Return in ascending order for the UI (oldest first in thread)
  return rows.reverse()
}

// ─── findOrCreateConversationByPhone ─────────────────────────────────────────
// Used by the webhook to find or create a conversation for an inbound message
export async function findOrCreateConversationByPhone(
  orgId: string,
  waPhone: string,
  waContactName: string | null,
  createdBy: string
): Promise<{ conversation: Conversation; created: boolean }> {
  // Look for an active (non-closed) conversation for this number
  const existing = await queryOne<Conversation>(
    `SELECT * FROM conversations
     WHERE org_id = $1 AND wa_phone = $2
       AND status NOT IN ('closed')
     ORDER BY last_message_at DESC NULLS LAST
     LIMIT 1`,
    [orgId, waPhone]
  )

  if (existing) return { conversation: existing, created: false }

  // Create new conversation
  const created = await queryOne<Conversation>(
    `INSERT INTO conversations
       (org_id, wa_phone, wa_contact_name, status, created_by, updated_by)
     VALUES ($1, $2, $3, 'open', $4, $4)
     RETURNING *`,
    [orgId, waPhone, waContactName, createdBy]
  )
  if (!created) throw new AppError('CONVERSATION_INSERT_FAILED', 'Conversation insert returned no row', 500)

  return { conversation: created, created: true }
}

// ─── insertInboundMessage ─────────────────────────────────────────────────────
// Used by webhook to persist incoming WA messages
export async function insertInboundMessage(
  orgId: string,
  conversationId: string,
  content: string,
  waMessageId: string,
  payload: Record<string, unknown>
): Promise<Message> {
  const msg = await queryOne<Message>(
    `INSERT INTO messages
       (org_id, conversation_id, direction, type, content, wa_message_id, status, payload)
     VALUES ($1, $2, 'inbound', 'manual', $3, $4, 'delivered', $5)
     RETURNING *`,
    [orgId, conversationId, content, waMessageId, JSON.stringify(payload)]
  )
  if (!msg) throw new AppError('INBOUND_MESSAGE_INSERT_FAILED', 'Inbound message insert returned no row', 500)

  // Update conversation: unread count + last message
  await query(
    `UPDATE conversations
     SET unread_count      = unread_count + 1,
         last_message_at   = now(),
         last_message_text = $3,
         updated_at        = now()
     WHERE id = $1 AND org_id = $2`,
    [conversationId, orgId, content.slice(0, 120)]
  )

  return msg
}
