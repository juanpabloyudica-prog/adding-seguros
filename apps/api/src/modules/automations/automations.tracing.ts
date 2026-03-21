import { query } from '../../infrastructure/db/client.js'
import { createModuleLogger } from '../../shared/logger.js'

const log = createModuleLogger('automations.tracing')

interface AutomationEventParams {
  orgId:              string
  action:             string   // 'scheduled_message_sent' | 'rule_triggered_manually' | etc.
  templateId?:        string
  templateName?:      string   // human-readable template name for timeline display
  ruleId?:            string
  ruleName?:          string   // human-readable rule name for timeline display
  conversationId?:    string
  policyId?:          string
  caseId?:            string
  quoteId?:           string
  isManual:           boolean
  triggeredByUserId?: string
  notes?:             string   // extra context (e.g. phone, template preview)
}

// Human-readable action labels for the timeline
const ACTION_LABELS: Record<string, string> = {
  scheduled_message_sent:     'Mensaje automático enviado',
  scheduled_message_failed:   'Error al enviar mensaje automático',
  scheduled_message_cancelled:'Mensaje automático cancelado',
  rule_triggered_manually:    'Regla disparada manualmente',
  rule_triggered_auto:        'Regla disparada automáticamente',
  message_scheduled:          'Mensaje automático programado',
}

/**
 * Builds a clear, human-readable description for the case timeline.
 * Avoids showing raw UUIDs — uses names wherever available.
 */
function buildTimelineNotes(params: AutomationEventParams): string {
  const parts: string[] = []

  // Action label
  const actionLabel = ACTION_LABELS[params.action] ?? params.action.replace(/_/g, ' ')
  parts.push(actionLabel)

  // Rule name (prefer human name over truncated ID)
  if (params.ruleName) {
    parts.push(`· regla "${params.ruleName}"`)
  }

  // Template name
  if (params.templateName) {
    parts.push(`· template "${params.templateName}"`)
  }

  // Manual vs automatic
  if (params.isManual) {
    parts.push('(manual)')
  }

  // Extra notes (e.g. sent-to phone, partial template body)
  if (params.notes) {
    parts.push(`— ${params.notes}`)
  }

  return parts.join(' ')
}

/**
 * Records an automation execution in the `events` table (append-only audit log).
 * If a case_id is provided, also writes a system_event entry in case_timeline_entries
 * so the case history is complete and human-readable.
 *
 * Never throws — failures are logged but not propagated.
 */
export async function recordAutomationEvent(params: AutomationEventParams): Promise<void> {
  try {
    const payload = JSON.stringify({
      action:          params.action,
      template_id:     params.templateId    ?? null,
      template_name:   params.templateName  ?? null,
      rule_id:         params.ruleId        ?? null,
      rule_name:       params.ruleName      ?? null,
      conversation_id: params.conversationId ?? null,
      policy_id:       params.policyId      ?? null,
      case_id:         params.caseId        ?? null,
      quote_id:        params.quoteId       ?? null,
      is_manual:       params.isManual,
      triggered_by:    params.triggeredByUserId ?? null,
      notes:           params.notes         ?? null,
    })

    // ── Write to events (audit log) ──────────────────────────────────────────
    await query(
      `INSERT INTO events
         (org_id, action, entity_type, entity_id, payload, conversation_id, case_id)
       VALUES ($1, $2, 'automation', $3, $4::jsonb, $5, $6)`,
      [
        params.orgId,
        params.action,
        params.ruleId ?? params.templateId ?? 'unknown',
        payload,
        params.conversationId ?? null,
        params.caseId         ?? null,
      ]
    )

    // ── Write to case timeline if case is linked ─────────────────────────────
    if (params.caseId) {
      const timelineNotes = buildTimelineNotes(params)

      await query(
        `INSERT INTO case_timeline_entries
           (case_id, type, notes, performed_by)
         VALUES ($1, 'system_event', $2, $3)`,
        [
          params.caseId,
          timelineNotes,
          params.triggeredByUserId ?? null,
        ]
      )
    }
  } catch (err) {
    log.error({ err, params }, 'Failed to record automation event — non-fatal')
  }
}
