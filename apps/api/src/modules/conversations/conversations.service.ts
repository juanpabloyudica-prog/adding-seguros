import { createModuleLogger } from '../../shared/logger.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors.js'
import { queryOne } from '../../infrastructure/db/client.js'
import { sendWhatsAppMessage } from '../../infrastructure/wasender/wasender.client.js'
import {
  findConversationById, listConversations,
  updateConversation, setEscalation, takeover, releaseLock,
  markAsRead, insertMessage, listMessages,
} from './conversations.repository.js'
import type { ConversationDetail } from './conversations.repository.js'
import type {
  ListConversationsInput, UpdateConversationInput,
  EscalateInput, TakeoverInput, SendMessageInput, ListMessagesInput,
} from './conversations.schema.js'
import type { Conversation, Message } from '@adding/types'

const log = createModuleLogger('conversations.service')

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserSignature(userId: string, orgId: string): Promise<string | null> {
  // Check if user is a producer — use producer signature
  const producer = await queryOne<{ signature_text: string | null; full_name: string }>(
    `SELECT pr.signature_text, u.full_name
     FROM producers pr JOIN users u ON u.id = pr.user_id
     WHERE pr.user_id = $1 AND pr.org_id = $2 AND pr.is_active = true
     LIMIT 1`,
    [userId, orgId]
  )
  if (producer?.signature_text) return producer.signature_text

  // Operativo — use generic broker signature
  const user = await queryOne<{ full_name: string }>(
    `SELECT full_name FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  )
  if (user?.full_name) {
    return `Hola, soy ${user.full_name}, del equipo de ADDING Seguros.`
  }
  return null
}

async function assertUserBelongsToOrg(userId: string, orgId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [userId, orgId]
  )
  if (!row) throw new ValidationError(`User '${userId}' not found in this organization`)
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getConversationById(id: string, orgId: string): Promise<ConversationDetail> {
  const conv = await findConversationById(id, orgId)
  if (!conv) throw new NotFoundError('Conversation', id)
  // Mark as read automatically when the conversation is opened
  await markAsRead(id, orgId)
  return conv
}

export async function getConversations(orgId: string, params: ListConversationsInput) {
  return listConversations(orgId, params)
}

export async function getConversationMessages(
  id: string, orgId: string, params: ListMessagesInput
): Promise<Message[]> {
  const conv = await findConversationById(id, orgId)
  if (!conv) throw new NotFoundError('Conversation', id)

  // Mark as read when opening the thread
  await markAsRead(id, orgId)
  return listMessages(id, orgId, params)
}

export async function updateConversationDetails(
  id: string, orgId: string,
  input: UpdateConversationInput,
  updatedBy: string
): Promise<Conversation> {
  const existing = await findConversationById(id, orgId)
  if (!existing) throw new NotFoundError('Conversation', id)

  const updated = await updateConversation(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Conversation', id)

  log.info({ conversationId: id, orgId, status: input.status, updatedBy }, 'Conversation updated')
  return updated
}

export async function escalateConversation(
  id: string, orgId: string,
  input: EscalateInput,
  escalatedBy: string
): Promise<Conversation> {
  const existing = await findConversationById(id, orgId)
  if (!existing) throw new NotFoundError('Conversation', id)

  await assertUserBelongsToOrg(input.escalated_to_user_id, orgId)

  const updated = await setEscalation(id, orgId, input.escalated_to_user_id, escalatedBy)
  if (!updated) throw new NotFoundError('Conversation', id)

  log.info(
    { conversationId: id, orgId, escalatedTo: input.escalated_to_user_id, escalatedBy },
    'Conversation escalated'
  )
  return updated
}

export async function deescalateConversation(
  id: string, orgId: string, updatedBy: string
): Promise<Conversation> {
  const existing = await findConversationById(id, orgId)
  if (!existing) throw new NotFoundError('Conversation', id)

  const updated = await setEscalation(id, orgId, null, updatedBy)
  if (!updated) throw new NotFoundError('Conversation', id)

  log.info({ conversationId: id, orgId, updatedBy }, 'Conversation de-escalated')
  return updated
}

export async function takeoverConversation(
  id: string, orgId: string,
  input: TakeoverInput,
  userId: string
): Promise<Conversation> {
  const existing = await findConversationById(id, orgId)
  if (!existing) throw new NotFoundError('Conversation', id)

  const result = await takeover(id, orgId, userId, input.force)

  if (!result.success) {
    if (result.lockedBy) {
      throw new ForbiddenError(
        `Conversation is locked by another user. Use force=true to take over.`
      )
    }
    throw new NotFoundError('Conversation', id)
  }

  const updated = await findConversationById(id, orgId)
  if (!updated) throw new NotFoundError('Conversation', id)

  log.info({ conversationId: id, orgId, userId, forced: input.force }, 'Conversation taken over')
  return updated
}

export async function releaseConversationLock(
  id: string, orgId: string, userId: string
): Promise<Conversation> {
  const existing = await findConversationById(id, orgId)
  if (!existing) throw new NotFoundError('Conversation', id)

  await releaseLock(id, orgId, userId)

  const updated = await findConversationById(id, orgId)
  if (!updated) throw new NotFoundError('Conversation', id)

  log.info({ conversationId: id, orgId, userId }, 'Conversation lock released')
  return updated
}

export async function sendMessage(
  id: string, orgId: string,
  input: SendMessageInput,
  userId: string
): Promise<Message> {
  const conv = await findConversationById(id, orgId)
  if (!conv) throw new NotFoundError('Conversation', id)

  const isInternal = input.is_internal_note || input.type === 'internal'
  let signatureText: string | null = null

  // Get user signature for external messages
  if (!isInternal) {
    signatureText = await getUserSignature(userId, orgId)
  }

  // Build final content with signature if applicable
  const finalContent = (!isInternal && signatureText && !input.content.includes(signatureText))
    ? input.content
    : input.content

  // Persist the message
  const message = await insertMessage(orgId, id, userId, { ...input, content: finalContent }, signatureText ?? undefined)

  // Send via Wasender for external outbound messages
  if (!isInternal && conv.wa_phone) {
    const fullMessage = signatureText
      ? `${finalContent}\n\n— ${signatureText}`
      : finalContent

    const result = await sendWhatsAppMessage({ to: conv.wa_phone, message: fullMessage })

    if (result.success && result.messageId) {
      // Update the message with the external WA id and sent status
      await queryOne(
        `UPDATE messages SET wa_message_id = $2, status = 'sent' WHERE id = $1 RETURNING id`,
        [message.id, result.messageId]
      )
    } else {
      await queryOne(
        `UPDATE messages SET status = 'failed', error_detail = $2 WHERE id = $1 RETURNING id`,
        [message.id, result.error ?? 'Send failed']
      )
      log.warn({ conversationId: id, messageId: message.id, error: result.error }, 'WA send failed')
    }
  }

  log.info(
    { conversationId: id, messageId: message.id, isInternal, orgId, userId },
    'Message sent'
  )
  return message
}
