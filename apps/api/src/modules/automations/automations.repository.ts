import { queryOne, queryMany, query } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { CreateTemplateInput, UpdateTemplateInput, CreateRuleInput, UpdateRuleInput, ListScheduledInput } from './automations.schema.js'

// ─── Template types ───────────────────────────────────────────────────────────
export interface Template {
  id: string; org_id: string; name: string; category: string | null
  type: string; body: string; variables: string[]; channel: string
  is_active: boolean; created_by: string; updated_by: string
  created_at: string; updated_at: string
}

// ─── Rule types ───────────────────────────────────────────────────────────────
export interface AutomationRule {
  id: string; org_id: string; name: string; template_id: string
  trigger_event: string; delay_hours: number; recurrence_days: number | null
  filter_producer_id: string | null; filter_company_id: string | null
  filter_ramo: string | null; filter_policy_type: string | null
  cancel_on_events: string[]; extra_conditions: Record<string, unknown>
  is_active: boolean; created_by: string; updated_by: string
  created_at: string; updated_at: string
}

export interface RuleDetail extends AutomationRule {
  template: { id: string; name: string; body: string } | null
}

// ─── Scheduled message types ──────────────────────────────────────────────────
export interface ScheduledMessage {
  id: string; org_id: string; conversation_id: string; template_id: string
  rule_id: string | null; case_id: string | null; policy_id: string | null
  quote_id: string | null; idempotency_key: string; scheduled_for: string
  status: string; variables: Record<string, unknown>
  cancel_reason: string | null; cancelled_at: string | null
  attempts: number; max_attempts: number; last_error: string | null
  created_at: string; updated_at: string
}

export interface ScheduledMessageDetail extends ScheduledMessage {
  template: { name: string; body: string } | null
  rule:     { name: string } | null
  conversation: { wa_phone: string; wa_contact_name: string | null } | null
}

// ─── Templates CRUD ───────────────────────────────────────────────────────────
export async function listTemplates(orgId: string): Promise<Template[]> {
  return queryMany<Template>(
    `SELECT * FROM message_templates WHERE org_id = $1 ORDER BY name ASC`,
    [orgId]
  )
}

export async function findTemplateById(id: string, orgId: string): Promise<Template | null> {
  return queryOne<Template>(
    `SELECT * FROM message_templates WHERE id = $1 AND org_id = $2 LIMIT 1`,
    [id, orgId]
  )
}

export async function createTemplate(
  orgId: string, input: CreateTemplateInput, createdBy: string
): Promise<Template> {
  // Extract variable names from body automatically
  const varNames = [...input.body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
  const uniqueVars = [...new Set(varNames)]

  const row = await queryOne<Template>(
    `INSERT INTO message_templates
       (org_id, name, type, category, body, variables, channel, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
     RETURNING *`,
    [orgId, input.name, input.type, input.category ?? null, input.body, uniqueVars, input.channel, createdBy]
  )
  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function updateTemplate(
  id: string, orgId: string, input: UpdateTemplateInput, updatedBy: string
): Promise<Template | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[] = [id, orgId, updatedBy]
  let idx = 4

  if (input.name      !== undefined) { setClauses.push(`name = $${idx}`);      values.push(input.name);      idx++ }
  if (input.type      !== undefined) { setClauses.push(`type = $${idx}`);      values.push(input.type);      idx++ }
  if (input.category  !== undefined) { setClauses.push(`category = $${idx}`);  values.push(input.category);  idx++ }
  if (input.is_active !== undefined) { setClauses.push(`is_active = $${idx}`); values.push(input.is_active); idx++ }
  if (input.body !== undefined) {
    // Re-extract variables when body changes
    const vars = [...new Set([...input.body.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))]
    setClauses.push(`body = $${idx}`, `variables = $${idx + 1}`)
    values.push(input.body, vars); idx += 2
  }

  return queryOne<Template>(
    `UPDATE message_templates SET ${setClauses.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}

// ─── Rules CRUD ───────────────────────────────────────────────────────────────
export async function listRules(orgId: string): Promise<RuleDetail[]> {
  return queryMany<RuleDetail>(
    `SELECT ar.*,
       json_build_object('id', mt.id, 'name', mt.name, 'body', mt.body) AS template
     FROM automation_rules ar
     LEFT JOIN message_templates mt ON mt.id = ar.template_id
     WHERE ar.org_id = $1
     ORDER BY ar.is_active DESC, ar.name ASC`,
    [orgId]
  )
}

export async function findRuleById(id: string, orgId: string): Promise<RuleDetail | null> {
  return queryOne<RuleDetail>(
    `SELECT ar.*,
       json_build_object('id', mt.id, 'name', mt.name, 'body', mt.body) AS template
     FROM automation_rules ar
     LEFT JOIN message_templates mt ON mt.id = ar.template_id
     WHERE ar.id = $1 AND ar.org_id = $2 LIMIT 1`,
    [id, orgId]
  )
}

export async function createRule(
  orgId: string, input: CreateRuleInput, createdBy: string
): Promise<AutomationRule> {
  const row = await queryOne<AutomationRule>(
    `INSERT INTO automation_rules
       (org_id, name, template_id, trigger_event, delay_hours, recurrence_days,
        filter_producer_id, filter_company_id, filter_ramo,
        cancel_on_events, extra_conditions, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     RETURNING *`,
    [
      orgId, input.name, input.template_id, input.trigger_event,
      input.delay_hours, input.recurrence_days ?? null,
      input.filter_producer_id ?? null, input.filter_company_id ?? null,
      input.filter_ramo ?? null,
      input.cancel_on_events, JSON.stringify(input.extra_conditions),
      createdBy,
    ]
  )
  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function updateRule(
  id: string, orgId: string, input: UpdateRuleInput, updatedBy: string
): Promise<AutomationRule | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[] = [id, orgId, updatedBy]
  let idx = 4

  const fields: (keyof UpdateRuleInput)[] = [
    'name','template_id','trigger_event','delay_hours','recurrence_days',
    'filter_producer_id','filter_company_id','filter_ramo',
    'cancel_on_events','extra_conditions','is_active',
  ]
  for (const f of fields) {
    if (input[f] !== undefined) { setClauses.push(`${f} = $${idx}`); values.push(input[f]); idx++ }
  }

  return queryOne<AutomationRule>(
    `UPDATE automation_rules SET ${setClauses.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}

// ─── Scheduled messages ───────────────────────────────────────────────────────
export async function listScheduledMessages(orgId: string, params: ListScheduledInput) {
  const { page, limit, status, rule_id, policy_id, case_id, upcoming_only } = params
  const offset = (page - 1) * limit

  const conds: string[] = ['sm.org_id = $1']
  const vals: unknown[] = [orgId]
  let idx = 2

  if (status)    { conds.push(`sm.status = $${idx}`);    vals.push(status);    idx++ }
  if (rule_id)   { conds.push(`sm.rule_id = $${idx}`);   vals.push(rule_id);   idx++ }
  if (policy_id) { conds.push(`sm.policy_id = $${idx}`); vals.push(policy_id); idx++ }
  if (case_id)   { conds.push(`sm.case_id = $${idx}`);   vals.push(case_id);   idx++ }
  if (upcoming_only) {
    conds.push(`sm.status = 'pending' AND sm.scheduled_for >= now()`)
  }

  const whereClause = conds.join(' AND ')

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM scheduled_messages sm WHERE ${whereClause}`, vals
  )
  const total = parseInt(countRow?.count ?? '0', 10)

  const rows = await queryMany<ScheduledMessageDetail>(
    `SELECT sm.*,
       json_build_object('name', mt.name, 'body', mt.body) AS template,
       CASE WHEN ar.id IS NOT NULL THEN json_build_object('name', ar.name) END AS rule,
       json_build_object('wa_phone', cv.wa_phone, 'wa_contact_name', cv.wa_contact_name) AS conversation
     FROM scheduled_messages sm
     LEFT JOIN message_templates mt ON mt.id = sm.template_id
     LEFT JOIN automation_rules ar  ON ar.id  = sm.rule_id
     LEFT JOIN conversations cv     ON cv.id  = sm.conversation_id
     WHERE ${whereClause}
     ORDER BY sm.scheduled_for ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...vals, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

export async function cancelScheduledMessage(
  id: string, orgId: string, userId: string, reason?: string
): Promise<ScheduledMessage | null> {
  return queryOne<ScheduledMessage>(
    `UPDATE scheduled_messages
     SET status = 'cancelled', cancel_reason = $4, cancelled_by = $3, cancelled_at = now(), updated_at = now()
     WHERE id = $1 AND org_id = $2 AND status IN ('pending')
     RETURNING *`,
    [id, orgId, userId, reason ?? 'Cancelado manualmente']
  )
}

// ─── Schedule a message from a rule + conversation ────────────────────────────
export async function scheduleMessage(params: {
  orgId:          string
  conversationId: string
  templateId:     string
  ruleId:         string
  policyId?:      string
  caseId?:        string
  quoteId?:       string
  scheduledFor:   Date
  variables:      Record<string, string>
  // Optional: stable label for idempotency (e.g. window_7d, window_15d).
  // When provided, the key is rule:policy:label — safe across multiple ticks
  // within the same window. When absent, falls back to rule:conversation:date.
  idempotencyWindowLabel?: string
}): Promise<ScheduledMessage | null> {
  const idemKey = params.idempotencyWindowLabel && params.policyId
    ? `${params.ruleId}:${params.policyId}:${params.idempotencyWindowLabel}`
    : `${params.ruleId}:${params.conversationId}:${params.scheduledFor.toISOString().split('T')[0]}`

  // Upsert: if key exists and is pending, do nothing
  return queryOne<ScheduledMessage>(
    `INSERT INTO scheduled_messages
       (org_id, conversation_id, template_id, rule_id, policy_id, case_id, quote_id,
        idempotency_key, scheduled_for, variables)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      params.orgId, params.conversationId, params.templateId, params.ruleId,
      params.policyId ?? null, params.caseId ?? null, params.quoteId ?? null,
      idemKey, params.scheduledFor.toISOString(),
      JSON.stringify(params.variables),
    ]
  )
}

// ─── getPendingToSend — used by scheduler ────────────────────────────────────
export async function getPendingToSend(limit = 20): Promise<(ScheduledMessage & {
  template: Template | null
  conversation: { id: string; wa_phone: string; org_id: string } | null
})[]> {
  return queryMany(
    `SELECT sm.*,
       row_to_json(mt) AS template,
       json_build_object('id', cv.id, 'wa_phone', cv.wa_phone, 'org_id', cv.org_id) AS conversation
     FROM scheduled_messages sm
     LEFT JOIN message_templates mt ON mt.id = sm.template_id
     LEFT JOIN conversations cv ON cv.id = sm.conversation_id
     WHERE sm.status = 'pending'
       AND sm.scheduled_for <= now()
       AND (sm.locked_until IS NULL OR sm.locked_until < now())
       AND sm.attempts < sm.max_attempts
     ORDER BY sm.scheduled_for ASC
     LIMIT $1`,
    [limit]
  )
}

export async function lockForProcessing(id: string, lockSeconds = 120): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `UPDATE scheduled_messages
     SET status = 'processing', locked_until = now() + ($2 || ' seconds')::interval,
         attempts = attempts + 1, last_attempted_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
       AND (locked_until IS NULL OR locked_until < now())
     RETURNING id`,
    [id, lockSeconds]
  )
  return row !== null
}

export async function markSent(id: string): Promise<void> {
  await query(
    `UPDATE scheduled_messages SET status = 'sent', locked_until = NULL, updated_at = now() WHERE id = $1`,
    [id]
  )
}

export async function markFailed(id: string, error: string): Promise<void> {
  await query(
    `UPDATE scheduled_messages
     SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
         last_error = $2, locked_until = NULL, updated_at = now()
     WHERE id = $1`,
    [id, error]
  )
}
