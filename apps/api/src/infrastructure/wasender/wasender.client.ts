import { createModuleLogger } from '../../shared/logger.js'

const log = createModuleLogger('wasender.client')

const WASENDER_URL = process.env['WASENDER_API_URL'] ?? 'https://www.wasender.app/api/send-message'
const WASENDER_KEY = process.env['WASENDER_API_KEY'] ?? ''

export interface WasenderSendParams {
  to:      string   // E.164 format: +5491155550001
  message: string
}

export interface WasenderSendResult {
  success:    boolean
  messageId?: string
  error?:     string
}

/**
 * Sends a WhatsApp text message via Wasender API.
 * Returns a result object — never throws, so callers can decide how to handle failures.
 */
export async function sendWhatsAppMessage(params: WasenderSendParams): Promise<WasenderSendResult> {
  if (!WASENDER_KEY) {
    log.warn('WASENDER_API_KEY not configured — message not sent')
    return { success: false, error: 'Wasender API key not configured' }
  }

  try {
    const res = await fetch(WASENDER_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${WASENDER_KEY}`,
      },
      body: JSON.stringify({
        phone:   params.to,
        message: params.message,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      log.error({ status: res.status, body, to: params.to }, 'Wasender send failed')
      return { success: false, error: `HTTP ${res.status}: ${body}` }
    }

    const data = await res.json() as { id?: string; messageId?: string }
    const messageId = data.id ?? data.messageId

    log.info({ to: params.to, messageId }, 'WhatsApp message sent')
    return { success: true, messageId }

  } catch (err) {
    log.error({ err, to: params.to }, 'Wasender send exception')
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
