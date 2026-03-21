import { createModuleLogger } from '../../shared/logger.js'
import { recordAutomationEvent } from './automations.tracing.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import { resolveTemplate } from '@adding/utils'
import {
  listTemplates, findTemplateById, createTemplate, updateTemplate,
  listRules, findRuleById, createRule, updateRule,
  listScheduledMessages, cancelScheduledMessage, scheduleMessage,
} from './automations.repository.js'
import type { Template, AutomationRule, RuleDetail } from './automations.repository.js'
import type {
  CreateTemplateInput, UpdateTemplateInput,
  CreateRuleInput, UpdateRuleInput,
  ListScheduledInput, ManualTriggerInput,
} from './automations.schema.js'

const log = createModuleLogger('automations.service')

// ─── Templates ────────────────────────────────────────────────────────────────
export async function getTemplates(orgId: string): Promise<Template[]> {
  return listTemplates(orgId)
}

export async function getTemplateById(id: string, orgId: string): Promise<Template> {
  const t = await findTemplateById(id, orgId)
  if (!t) throw new NotFoundError('Template', id)
  return t
}

export async function createNewTemplate(
  orgId: string, input: CreateTemplateInput, createdBy: string
): Promise<Template> {
  const t = await createTemplate(orgId, input, createdBy)
  log.info({ templateId: t.id, name: t.name, orgId }, 'Template created')
  return t
}

export async function updateExistingTemplate(
  id: string, orgId: string, input: UpdateTemplateInput, updatedBy: string
): Promise<Template> {
  const existing = await findTemplateById(id, orgId)
  if (!existing) throw new NotFoundError('Template', id)
  const updated = await updateTemplate(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Template', id)
  return updated
}

export function previewTemplate(body: string, variables: Record<string, string>): string {
  return resolveTemplate(body, variables)
}

// ─── Rules ────────────────────────────────────────────────────────────────────
export async function getRules(orgId: string): Promise<RuleDetail[]> {
  return listRules(orgId)
}

export async function getRuleById(id: string, orgId: string): Promise<RuleDetail> {
  const r = await findRuleById(id, orgId)
  if (!r) throw new NotFoundError('AutomationRule', id)
  return r
}

export async function createNewRule(
  orgId: string, input: CreateRuleInput, createdBy: string
): Promise<AutomationRule> {
  // Validate template belongs to org
  const template = await findTemplateById(input.template_id, orgId)
  if (!template) throw new ValidationError(`Template '${input.template_id}' not found`)

  const rule = await createRule(orgId, input, createdBy)
  log.info({ ruleId: rule.id, trigger: input.trigger_event, orgId }, 'Automation rule created')
  return rule
}

export async function updateExistingRule(
  id: string, orgId: string, input: UpdateRuleInput, updatedBy: string
): Promise<AutomationRule> {
  const existing = await findRuleById(id, orgId)
  if (!existing) throw new NotFoundError('AutomationRule', id)

  if (input.template_id) {
    const template = await findTemplateById(input.template_id, orgId)
    if (!template) throw new ValidationError(`Template '${input.template_id}' not found`)
  }

  const updated = await updateRule(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('AutomationRule', id)
  return updated
}

// ─── Scheduled messages ───────────────────────────────────────────────────────
export async function getScheduledMessages(orgId: string, params: ListScheduledInput) {
  return listScheduledMessages(orgId, params)
}

export async function cancelMessage(
  id: string, orgId: string, userId: string, reason?: string
) {
  const row = await cancelScheduledMessage(id, orgId, userId, reason)
  if (!row) {
    throw new ValidationError('Message not found or not in a cancellable state (must be pending)')
  }
  log.info({ id, orgId, userId, reason }, 'Scheduled message cancelled')
  return row
}

// ─── Manual trigger ───────────────────────────────────────────────────────────
// Manually fires a rule for a specific conversation without waiting for the scheduler.
// Used from: vencimientos (send reminder now) or cases (send follow-up now).
export async function manualTrigger(
  orgId: string, input: ManualTriggerInput, triggeredBy: string
) {
  const rule     = await findRuleById(input.rule_id, orgId)
  if (!rule) throw new NotFoundError('AutomationRule', input.rule_id)

  const template = await findTemplateById(rule.template_id, orgId)
  if (!template) throw new NotFoundError('Template', rule.template_id)

  // Verify conversation exists in org
  const conv = await queryOne<{ id: string; wa_phone: string }>(
    `SELECT id, wa_phone FROM conversations WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [input.conversation_id, orgId]
  )
  if (!conv) throw new NotFoundError('Conversation', input.conversation_id)

  const scheduledFor = input.send_now
    ? new Date()
    : new Date(Date.now() + rule.delay_hours * 3_600_000)

  const msg = await scheduleMessage({
    orgId,
    conversationId: input.conversation_id,
    templateId:     rule.template_id,
    ruleId:         rule.id,
    policyId:       input.policy_id,
    caseId:         input.case_id,
    scheduledFor,
    variables:      input.variables ?? {},
  })

  // If send_now, run the scheduler immediately for this message
  if (input.send_now && msg) {
    const { processPendingMessages } = await import('../../scheduler/message.scheduler.js')
    processPendingMessages().catch((err) => log.error({ err }, 'Immediate send failed'))
  }

  // Record traceability event
  await recordAutomationEvent({
    orgId,
    action:           'rule_triggered_manually',
    templateId:       rule.template_id,
    templateName:     template.name,
    ruleId:           rule.id,
    ruleName:         rule.name,
    conversationId:   input.conversation_id,
    policyId:         input.policy_id,
    caseId:           input.case_id,
    isManual:         true,
    triggeredByUserId: triggeredBy,
    notes:            input.send_now ? 'enviado inmediatamente' : `programado para ${scheduledFor.toLocaleString('es-AR')}`,
  })

  log.info({
    ruleId: rule.id, conversationId: input.conversation_id, orgId, triggeredBy, sendNow: input.send_now,
  }, 'Manual rule triggered')

  return { scheduled: msg, scheduledFor, preview: resolveTemplate(template.body, input.variables ?? {}) }
}

// ─── Fire rules for an event (called by other modules) ───────────────────────
export async function fireRulesForEvent(params: {
  orgId:           string
  triggerEvent:    string
  conversationId?: string
  policyId?:       string
  caseId?:         string
  quoteId?:        string
  variables:       Record<string, string>
  systemUserId:    string
  // Optional: passed through to scheduleMessage for stable idempotency keys
  // across multiple scheduler ticks within the same event window.
  idempotencyWindowLabel?: string
}): Promise<void> {
  // Find ALL active rules for this trigger (not just one)
  const rules = await queryMany<{ id: string; name: string; template_id: string; delay_hours: number }>(
    `SELECT id, name, template_id, delay_hours
     FROM automation_rules
     WHERE org_id = $1 AND trigger_event = $2 AND is_active = true
     ORDER BY created_at ASC`,
    [params.orgId, params.triggerEvent]
  )

  if (!rules.length) return

  log.info(
    { event: params.triggerEvent, orgId: params.orgId, ruleCount: rules.length },
    'Firing rules for event'
  )

  for (const rule of rules) {
    // Without a conversationId we can't schedule a WA message.
    // The expiring-policy job always resolves a conversationId before calling here.
    // Other callers (case hooks, webhook) skip gracefully when no conversation exists.
    if (!params.conversationId) {
      log.info(
        {
          ruleId:   rule.id,
          ruleName: rule.name,
          event:    params.triggerEvent,
          policyId: params.policyId ?? null,
          caseId:   params.caseId   ?? null,
          orgId:    params.orgId,
        },
        'Rule matched event but no conversationId — message not scheduled. ' +
        'Provide a conversationId to enable WA scheduling for this rule.'
      )
      continue
    }
    const scheduledFor = new Date(Date.now() + rule.delay_hours * 3_600_000)

    await scheduleMessage({
      orgId:          params.orgId,
      conversationId: params.conversationId,
      templateId:     rule.template_id,
      ruleId:         rule.id,
      policyId:       params.policyId,
      caseId:         params.caseId,
      quoteId:        params.quoteId,
      scheduledFor,
      variables:      params.variables,
      idempotencyWindowLabel: params.idempotencyWindowLabel,
    })

    await recordAutomationEvent({
      orgId:            params.orgId,
      action:           'message_scheduled',
      templateId:       rule.template_id,
      ruleId:           rule.id,
      ruleName:         rule.name,
      conversationId:   params.conversationId,
      policyId:         params.policyId,
      caseId:           params.caseId,
      isManual:         false,
      triggeredByUserId: params.systemUserId,
      notes:            `disparado por ${params.triggerEvent}`,
    })

    log.info(
      { ruleId: rule.id, event: params.triggerEvent, scheduledFor, orgId: params.orgId },
      'Rule fired for event'
    )
  }
}
