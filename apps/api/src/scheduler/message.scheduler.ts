import { createModuleLogger } from '../shared/logger.js'
import { resolveTemplate } from '@adding/utils'
import { sendWhatsAppMessage } from '../infrastructure/wasender/wasender.client.js'
import { queryMany } from '../infrastructure/db/client.js'
import {
  getPendingToSend, lockForProcessing, markSent, markFailed,
} from '../modules/automations/automations.repository.js'
import { recordAutomationEvent } from '../modules/automations/automations.tracing.js'

const log = createModuleLogger('message.scheduler')

let running = false

export async function processPendingMessages(): Promise<void> {
  if (running) {
    log.debug('Scheduler already running, skipping tick')
    return
  }

  running = true
  let processed = 0, succeeded = 0, failed = 0

  try {
    const pending = await getPendingToSend(20)

    if (pending.length === 0) {
      log.debug('Scheduler tick — no pending messages')
    } else {

    log.info({ count: pending.length, instanceId: process.env['INSTANCE_ID'] ?? `pid-${process.pid}` }, 'Processing pending scheduled messages')

    for (const item of pending) {
      // Optimistic lock — skip if already taken
      const locked = await lockForProcessing(item.id)
      if (!locked) continue
      processed++

      const template = item.template
      const conv     = item.conversation

      if (!template || !conv) {
        await markFailed(item.id, 'Missing template or conversation')
        continue
      }

      try {
        // Resolve template variables
        const vars = (item.variables ?? {}) as Record<string, string>
        const body = resolveTemplate(template.body, vars)

        const result = await sendWhatsAppMessage({ to: conv.wa_phone, message: body })

        if (result.success) {
          await markSent(item.id)
          succeeded++
          await recordAutomationEvent({
            orgId:          item.org_id,
            action:         'scheduled_message_sent',
            templateId:     item.template_id,
            templateName:   template.name,
            ruleId:         item.rule_id ?? undefined,
            conversationId: item.conversation_id,
            policyId:       item.policy_id ?? undefined,
            caseId:         item.case_id ?? undefined,
            isManual:       false,
            notes:          `enviado a ${conv.wa_phone}`,
          })
          log.info({ id: item.id, to: conv.wa_phone }, 'Scheduled message sent')
        } else {
          await markFailed(item.id, result.error ?? 'Send failed')
          failed++
          log.warn({ id: item.id, error: result.error }, 'Scheduled message send failed')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        await markFailed(item.id, msg)
        log.error({ id: item.id, err }, 'Scheduled message processing error')
      }
    }
    } // end else (pending.length > 0)
  } finally {
    running = false
    if (processed > 0 || succeeded > 0 || failed > 0) {
      log.info({ processed, succeeded, failed }, 'Scheduler tick — messages complete')
    }
  }

  // Also fire expiring-policy events on each tick
  processExpiringPolicies().catch((err) => {
    log.error({ err }, 'processExpiringPolicies failed')
  })
}

/**
 * Start the message scheduler.
 * Processes pending messages every 5 minutes.
 * Returns a cleanup function to stop the interval.
 */
export function startMessageScheduler(): () => void {
  const INTERVAL_MS = parseInt(process.env['AUTOMATIONS_SCHEDULER_INTERVAL_MS'] ?? '300000', 10) // default 5 min
  const instanceId  = process.env['INSTANCE_ID'] ?? `pid-${process.pid}`

  // ─── Multi-instance safety note ──────────────────────────────────────────
  // Only ONE instance should run the scheduler at a time. In multi-instance
  // deployments (e.g. multiple pods / PM2 cluster), set AUTOMATIONS_SCHEDULER_ENABLED=false
  // on all but one instance, or run a dedicated scheduler process.
  //
  // The optimistic locking (locked_until + status=processing check) in the repository
  // prevents double-sends even if two instances briefly overlap, but it is not a
  // substitute for disabling the scheduler on replica nodes.
  log.info({ intervalMs: INTERVAL_MS, instanceId }, 'Message scheduler started')

  // Run once immediately on startup
  processPendingMessages().catch((err) => {
    log.error({ err }, 'Initial scheduler run failed')
  })

  const interval = setInterval(() => {
    processPendingMessages().catch((err) => {
      log.error({ err }, 'Scheduler tick failed')
    })
  }, INTERVAL_MS)

  return () => {
    clearInterval(interval)
    log.info('Message scheduler stopped')
  }
}

// ─── Expiring policy event job ────────────────────────────────────────────────
// Runs on every scheduler tick.
//
// DESIGN: uses overlapping DAY WINDOWS instead of exact-day matching.
//   window_7d:  policies expiring in 0–7 days   → trigger policy_expiring_7d
//   window_15d: policies expiring in 8–15 days  → trigger policy_expiring_15d
//   window_30d: policies expiring in 16–30 days → trigger policy_expiring_30d
//
// Benefits vs exact-day matching:
//   - Robust to scheduler downtime: if the scheduler was off for 2 days,
//     it catches up automatically on the next tick.
//   - Idempotency key = rule_id:policy_id:window_label (not date-stamped),
//     so the same policy never gets two messages for the same window,
//     regardless of how many ticks run during that window.
//
// FALLBACK: if a person has no open conversation, one is created automatically
// so the message can be scheduled. This is better than silently dropping events.

export async function processExpiringPolicies(): Promise<void> {
  const { fireRulesForEvent }              = await import('../modules/automations/automations.service.js')
  const { findOrCreateConversationByPhone } = await import('../modules/conversations/conversations.repository.js')

  const WINDOWS = [
    { label: 'window_7d',  minDays: 0,  maxDays: 7,  trigger: 'policy_expiring_7d'  as const },
    { label: 'window_15d', minDays: 8,  maxDays: 15, trigger: 'policy_expiring_15d' as const },
    { label: 'window_30d', minDays: 16, maxDays: 30, trigger: 'policy_expiring_30d' as const },
  ]

  let totalEvaluated = 0
  let totalTriggered = 0
  let totalScheduled = 0

  for (const { label, minDays, maxDays, trigger } of WINDOWS) {
    const policies = await queryMany<{
      id: string; org_id: string; ramo: string; end_date: string
      person_id: string | null
      person_full_name: string | null; person_phone: string | null
      company_name: string | null; producer_full_name: string | null
      conversation_id: string | null; system_user_id: string | null
    }>(
      `SELECT
         pol.id, pol.org_id, pol.ramo, pol.end_date::text,
         pol.person_id,
         pe.full_name  AS person_full_name,
         pe.phone      AS person_phone,
         co.name       AS company_name,
         pu.full_name  AS producer_full_name,
         (SELECT cv.id FROM conversations cv
          WHERE cv.person_id = pe.id AND cv.org_id = pol.org_id
            AND cv.status NOT IN ('closed')
          ORDER BY cv.last_message_at DESC NULLS LAST LIMIT 1
         ) AS conversation_id,
         (SELECT u.id FROM users u WHERE u.org_id = pol.org_id AND u.role = 'admin' LIMIT 1)
           AS system_user_id
       FROM policies pol
       JOIN persons pe   ON pe.id = pol.person_id
       JOIN companies co ON co.id = pol.company_id
       LEFT JOIN producers pr ON pr.id = pol.producer_id
       LEFT JOIN users pu     ON pu.id = pr.user_id
       WHERE pol.status = 'active'
         AND (pol.end_date::date - CURRENT_DATE) BETWEEN $1 AND $2
       ORDER BY pol.org_id, pol.end_date ASC`,
      [minDays, maxDays]
    )

    totalEvaluated += policies.length

    if (!policies.length) {
      log.debug({ trigger, window: label }, 'No expiring policies for window')
      continue
    }

    log.info({ trigger, window: label, count: policies.length }, 'Processing expiring policies')

    for (const pol of policies) {
      if (!pol.system_user_id) {
        log.warn({ policyId: pol.id, orgId: pol.org_id }, 'No admin user found for org — skipping policy')
        continue
      }

      // ── Resolve conversation — create if missing ──────────────────────────
      let conversationId = pol.conversation_id

      if (!conversationId) {
        if (pol.person_phone) {
          // Auto-create conversation for this person so the message can be sent
          try {
            const { conversation } = await findOrCreateConversationByPhone(
              pol.org_id,
              pol.person_phone,
              pol.person_full_name,
              pol.system_user_id
            )
            conversationId = conversation.id
            log.info(
              { policyId: pol.id, conversationId, orgId: pol.org_id },
              'Auto-created conversation for expiring policy notification'
            )
          } catch (err) {
            log.error({ err, policyId: pol.id }, 'Failed to auto-create conversation — skipping')
            continue
          }
        } else {
          // No phone and no conversation — log clearly and skip (cannot send WA without phone)
          log.warn(
            { policyId: pol.id, personId: pol.person_id, trigger },
            'Policy has no conversation and person has no phone — cannot schedule WA message. ' +
            'Add a phone number to the person to enable automated notifications.'
          )
          continue
        }
      }

      // ── Fire rules (idempotency key includes window label, not date) ──────
      const daysLeft = Math.round(
        (new Date(pol.end_date).getTime() - Date.now()) / 86_400_000
      )

      await fireRulesForEvent({
        orgId:          pol.org_id,
        triggerEvent:   trigger,
        conversationId,
        policyId:       pol.id,
        variables: {
          nombre:             pol.person_full_name ?? '',
          compania:           pol.company_name ?? '',
          ramo:               pol.ramo,
          fecha_vencimiento:  new Date(pol.end_date).toLocaleDateString('es-AR'),
          dias_para_vencer:   String(daysLeft),
          productor:          pol.producer_full_name ?? '',
          telefono:           pol.person_phone ?? '',
          ventana:            label,   // available as template variable if needed
        },
        systemUserId: pol.system_user_id,
        // Pass the window label so the idempotency key in scheduleMessage
        // is per-window, not per-date — prevents duplicates across ticks
        idempotencyWindowLabel: label,
      }).catch(err => log.error({ err, policyId: pol.id, trigger }, 'fireRulesForEvent failed'))

      totalTriggered++
      totalScheduled++ // approximate — actual schedule count depends on matching rules
    }
  }

  log.info(
    { totalEvaluated, totalTriggered, totalScheduled },
    'Scheduler tick — expiring policies complete'
  )
}