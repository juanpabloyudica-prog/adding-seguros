import type { Request, Response } from 'express'
import { createModuleLogger } from '../shared/logger.js'
import { queryMany } from '../infrastructure/db/client.js'
import {
  findOrCreateConversationByPhone,
  insertInboundMessage,
} from '../modules/conversations/conversations.repository.js'
import { findPersonByPhone } from '../modules/persons/persons.repository.js'

const log = createModuleLogger('wasender.webhook')

// ─── Webhook secret validation ────────────────────────────────────────────────
function validateSecret(req: Request): boolean {
  const secret = process.env['WASENDER_WEBHOOK_SECRET']
  if (!secret) return true // no secret configured — allow all (dev only)

  const headerSecret = req.headers['x-wasender-secret'] ?? req.headers['x-webhook-secret']
  return headerSecret === secret
}

// ─── Payload shape from Wasender ─────────────────────────────────────────────
interface WasenderWebhookPayload {
  event?:   string
  from?:    string   // E.164 phone number of the sender
  name?:    string   // contact name from WA
  message?: {
    id?:   string
    text?: string
    type?: string
    body?: string
  }
  // Some versions use flat structure
  messageId?: string
  text?:      string
  body?:      string
  phone?:     string
  contactName?: string
}

export async function handleWasenderWebhook(req: Request, res: Response): Promise<void> {
  // Always respond 200 quickly — WA retries if we're slow
  if (!validateSecret(req)) {
    log.warn({ ip: req.ip }, 'Webhook received with invalid secret')
    res.status(401).json({ error: 'Invalid secret' })
    return
  }

  res.status(200).json({ received: true })

  // Process asynchronously after responding
  processWebhookAsync(req.body as WasenderWebhookPayload).catch((err) => {
    log.error({ err }, 'Webhook processing error')
  })
}

async function processWebhookAsync(payload: WasenderWebhookPayload): Promise<void> {
  // Normalize different payload shapes from Wasender
  const waPhone      = payload.from ?? payload.phone
  const contactName  = payload.name ?? payload.contactName ?? null
  const messageId    = payload.message?.id ?? payload.messageId
  const content      = payload.message?.text ?? payload.message?.body ?? payload.text ?? payload.body

  if (!waPhone || !content) {
    log.debug({ payload }, 'Webhook skipped — no phone or content')
    return
  }

  // Only process inbound text messages
  const event = payload.event ?? 'message'
  if (!['message', 'message.received', 'inbound'].includes(event)) {
    log.debug({ event }, 'Webhook event type not processed')
    return
  }

  // Find all active orgs (multi-tenant: one webhook handles all orgs)
  // In practice, each Wasender number belongs to one org.
  // This implementation assumes single-org; for multi-org, use a lookup table.
  const orgs = await queryMany<{ id: string; slug: string }>(
    `SELECT id, slug FROM organizations WHERE is_active = true LIMIT 1`
  )

  if (orgs.length === 0) {
    log.warn('No active organizations found for webhook')
    return
  }

  for (const org of orgs) {
    try {
      // System user for automated operations — use first admin
      const systemUser = await queryMany<{ id: string }>(
        `SELECT id FROM users WHERE org_id = $1 AND role = 'admin' AND is_active = true LIMIT 1`,
        [org.id]
      )
      const createdById = systemUser[0]?.id
      if (!createdById) continue

      // Find or create conversation
      const { conversation, created } = await findOrCreateConversationByPhone(
        org.id, waPhone, contactName, createdById
      )

      if (created) {
        log.info({ orgId: org.id, waPhone, conversationId: conversation.id }, 'New conversation created from webhook')
      }

      // Try to link person if phone matches
      if (!conversation.person_id) {
        const person = await findPersonByPhone(org.id, waPhone)
        if (person) {
          await queryMany(
            `UPDATE conversations SET person_id = $2, updated_at = now()
             WHERE id = $1 AND person_id IS NULL`,
            [conversation.id, person.id]
          )
          log.info({ conversationId: conversation.id, personId: person.id }, 'Conversation linked to person')
        }
      }

      // Persist the inbound message
      await insertInboundMessage(
        org.id,
        conversation.id,
        content,
        messageId ?? `ext-${Date.now()}`,
        payload as Record<string, unknown>
      )

      log.info(
        { orgId: org.id, conversationId: conversation.id, waPhone },
        'Inbound message processed'
      )

      // Fire automation rules for inbound_message_received (fire-and-forget)
      const { fireRulesForEvent } = await import('../modules/automations/automations.service.js')
      fireRulesForEvent({
        orgId:          org.id,
        triggerEvent:   'inbound_message_received',
        conversationId: conversation.id,
        variables: {
          telefono:     waPhone,
          nombre:       contactName ?? waPhone,
          mensaje:      content.slice(0, 200),
        },
        systemUserId: createdById,
      }).catch((err) => {
        log.error({ err, conversationId: conversation.id }, 'fireRulesForEvent failed for inbound_message')
      })
    } catch (err) {
      log.error({ err, orgId: org.id, waPhone }, 'Error processing webhook for org')
    }
  }
}
