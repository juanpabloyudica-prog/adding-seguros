import { queryOne, queryMany, withTransaction } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Case, CaseTimelineEntry } from '@adding/types'
import type {
  CreateCaseInput, UpdateCaseInput, TransitionCaseStatusInput,
  TransitionStepInput, CloseCaseInput, AddTimelineNoteInput,
  ListCasesInput,
} from './cases.schema.js'

// ─── Detail shape ─────────────────────────────────────────────────────────────
export interface CaseDetail extends Case {
  person:       { id: string; full_name: string; phone: string | null } | null
  policy:       { id: string; policy_number: string; ramo: string; status: string } | null
  producer:     { id: string; full_name: string } | null
  assigned_to:  { id: string; full_name: string } | null
  escalated_to: { id: string; full_name: string } | null
  workflow:     {
    id: string; name: string
    steps: Array<{ key: string; label: string; step_order: number; allowed_transitions: string[] }>
  } | null
  timeline:     CaseTimelineEntry[]
}

// ─── SELECT/JOIN fragments ────────────────────────────────────────────────────
const CASE_SELECT = `
  c.*,
  json_build_object('id', pe.id, 'full_name', pe.full_name, 'phone', pe.phone) AS person,
  CASE WHEN pol.id IS NOT NULL THEN
    json_build_object('id', pol.id, 'policy_number', pol.policy_number, 'ramo', pol.ramo, 'status', pol.status)
  END AS policy,
  CASE WHEN pr.id IS NOT NULL THEN
    json_build_object('id', pr.id, 'full_name', pu.full_name)
  END AS producer,
  CASE WHEN ua.id IS NOT NULL THEN
    json_build_object('id', ua.id, 'full_name', ua.full_name)
  END AS assigned_to,
  CASE WHEN ue.id IS NOT NULL THEN
    json_build_object('id', ue.id, 'full_name', ue.full_name)
  END AS escalated_to
`

const CASE_JOINS = `
  JOIN persons pe      ON pe.id  = c.person_id
  LEFT JOIN policies pol ON pol.id = c.policy_id
  LEFT JOIN producers pr ON pr.id = c.producer_id
  LEFT JOIN users pu     ON pu.id = pr.user_id
  LEFT JOIN users ua     ON ua.id = c.assigned_to_user_id
  LEFT JOIN users ue     ON ue.id = c.escalated_to_user_id
`

// ─── findCaseById ─────────────────────────────────────────────────────────────
export async function findCaseById(id: string, orgId: string): Promise<CaseDetail | null> {
  const row = await queryOne<Case>(
    `SELECT ${CASE_SELECT} FROM cases c ${CASE_JOINS}
     WHERE c.id = $1 AND c.org_id = $2 LIMIT 1`,
    [id, orgId]
  )
  if (!row) return null

  // Load workflow with steps
  const workflow = row.workflow_id
    ? await queryOne<{ id: string; name: string }>(
        `SELECT id, name FROM case_workflows WHERE id = $1`, [row.workflow_id]
      )
    : null

  const steps = row.workflow_id
    ? await queryMany<{ key: string; label: string; step_order: number; allowed_transitions: string[] }>(
        `SELECT key, label, step_order, allowed_transitions
         FROM case_workflow_steps WHERE workflow_id = $1 ORDER BY step_order`,
        [row.workflow_id]
      )
    : []

  // Load timeline (most recent 50 entries)
  const timeline = await queryMany<CaseTimelineEntry>(
    `SELECT t.*,
       CASE WHEN u.id IS NOT NULL THEN
         json_build_object('id', u.id, 'full_name', u.full_name)
       END AS performer
     FROM case_timeline_entries t
     LEFT JOIN users u ON u.id = t.performed_by
     WHERE t.case_id = $1
     ORDER BY t.created_at DESC LIMIT 50`,
    [id]
  )

  return {
    ...(row as unknown as CaseDetail),
    workflow: workflow ? { ...workflow, steps } : null,
    timeline: timeline.reverse(), // chronological for UI
  }
}

// ─── listCases ────────────────────────────────────────────────────────────────
export async function listCases(orgId: string, params: ListCasesInput) {
  const { page, limit, person_id, policy_id, producer_id, assigned_to_user_id,
          type, status, priority, search, open_only, overdue_only } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['c.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (person_id)           { conditions.push(`c.person_id = $${idx}`);           values.push(person_id);           idx++ }
  if (policy_id)           { conditions.push(`c.policy_id = $${idx}`);           values.push(policy_id);           idx++ }
  if (producer_id)         { conditions.push(`c.producer_id = $${idx}`);         values.push(producer_id);         idx++ }
  if (assigned_to_user_id) { conditions.push(`c.assigned_to_user_id = $${idx}`); values.push(assigned_to_user_id); idx++ }
  if (type)                { conditions.push(`c.type = $${idx}`);                values.push(type);                idx++ }
  if (status)              { conditions.push(`c.status = $${idx}`);              values.push(status);              idx++ }
  if (priority)            { conditions.push(`c.priority = $${idx}`);            values.push(priority);            idx++ }
  if (search) {
    conditions.push(`(c.title ILIKE $${idx} OR pe.full_name ILIKE $${idx})`)
    values.push(`%${search}%`); idx++
  }
  if (open_only) {
    conditions.push(`c.status NOT IN ('closed','cancelled')`)
  }
  if (overdue_only) {
    conditions.push(`c.due_date < CURRENT_DATE AND c.status NOT IN ('closed','cancelled')`)
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM cases c ${CASE_JOINS} WHERE ${whereClause}`, values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<Case>(
    `SELECT ${CASE_SELECT},
       (c.due_date < CURRENT_DATE AND c.status NOT IN ('closed','cancelled'))::boolean AS is_overdue,
       (SELECT COUNT(*) FROM conversations cv WHERE cv.case_id = c.id AND cv.status != 'closed')::int AS conversation_count,
       (SELECT COUNT(*) FROM conversations cv WHERE cv.case_id = c.id AND cv.status != 'closed' AND cv.unread_count > 0)::int AS unread_conversation_count,
       (SELECT COUNT(*) FROM documents d WHERE d.entity_type = 'case' AND d.entity_id = c.id)::int AS document_count
     FROM cases c ${CASE_JOINS}
     WHERE ${whereClause}
     ORDER BY
       CASE c.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
       c.due_date ASC NULLS LAST,
       c.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── createCase ───────────────────────────────────────────────────────────────
export async function createCase(
  orgId: string, input: CreateCaseInput, createdBy: string
): Promise<Case> {
  return withTransaction(async (client) => {
    // Resolve default workflow for this case type
    const workflow = await client.query<{ id: string }>(
      `SELECT id FROM case_workflows
       WHERE org_id = $1 AND case_type = $2 AND is_default = true AND is_active = true
       LIMIT 1`,
      [orgId, input.type]
    )
    const workflowId    = input.workflow_id ?? workflow.rows[0]?.id ?? null

    // Get first step of workflow
    let firstStepKey: string | null = null
    if (workflowId) {
      const step = await client.query<{ key: string }>(
        `SELECT key FROM case_workflow_steps WHERE workflow_id = $1 ORDER BY step_order LIMIT 1`,
        [workflowId]
      )
      firstStepKey = step.rows[0]?.key ?? null
    }

    const { rows } = await client.query<Case>(
      `INSERT INTO cases (
         org_id, person_id, policy_id, producer_id, assigned_to_user_id,
         workflow_id, current_step_key, type, priority, title, description,
         due_date, required_documents, status, created_by, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'open',$14,$14)
       RETURNING *`,
      [
        orgId,
        input.person_id,
        input.policy_id           ?? null,
        input.producer_id         ?? null,
        input.assigned_to_user_id ?? null,
        workflowId,
        firstStepKey,
        input.type,
        input.priority,
        input.title,
        input.description         ?? null,
        input.due_date            ?? null,
        input.required_documents  ?? [],
        createdBy,
      ]
    )
    const newCase = rows[0]
    if (!newCase) throw new Error('Case insert returned no row')

    // Write initial timeline entry
    await client.query(
      `INSERT INTO case_timeline_entries (case_id, type, to_value, notes, performed_by)
       VALUES ($1, 'status_change', 'open', $2, $3)`,
      [newCase.id, `Caso creado: ${input.title}`, createdBy]
    )

    return newCase
  })
}

// ─── updateCase ───────────────────────────────────────────────────────────────
export async function updateCase(
  id: string, orgId: string, input: UpdateCaseInput, updatedBy: string,
  timelineNotes?: string
): Promise<Case | null> {
  return withTransaction(async (client) => {
    const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
    const values: unknown[]    = [id, orgId, updatedBy]
    let idx = 4

    const fields: (keyof UpdateCaseInput)[] = [
      'producer_id','assigned_to_user_id','escalated_to_user_id',
      'priority','title','description','due_date','required_documents','current_step_key',
    ]
    for (const f of fields) {
      if (input[f] !== undefined) { setClauses.push(`${f} = $${idx}`); values.push(input[f]); idx++ }
    }

    const { rows } = await client.query<Case>(
      `UPDATE cases SET ${setClauses.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
      values
    )
    const updated = rows[0]
    if (!updated) return null

    if (timelineNotes) {
      await client.query(
        `INSERT INTO case_timeline_entries (case_id, type, notes, performed_by)
         VALUES ($1, 'system_event', $2, $3)`,
        [id, timelineNotes, updatedBy]
      )
    }
    return updated
  })
}

// ─── transitionStatus ────────────────────────────────────────────────────────
export async function transitionCaseStatus(
  id: string, orgId: string,
  input: TransitionCaseStatusInput,
  updatedBy: string,
  fromStatus: string
): Promise<Case | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Case>(
      `UPDATE cases SET status = $3, updated_by = $4, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, input.status, updatedBy]
    )
    const updated = rows[0]
    if (!updated) return null

    await client.query(
      `INSERT INTO case_timeline_entries (case_id, type, from_value, to_value, notes, performed_by)
       VALUES ($1, 'status_change', $2, $3, $4, $5)`,
      [id, fromStatus, input.status, input.notes ?? null, updatedBy]
    )
    return updated
  })
}

// ─── transitionStep ──────────────────────────────────────────────────────────
export async function transitionCaseStep(
  id: string, orgId: string,
  input: TransitionStepInput,
  updatedBy: string,
  fromStep: string | null
): Promise<Case | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Case>(
      `UPDATE cases SET current_step_key = $3, status = 'in_progress', updated_by = $4, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, input.to_step_key, updatedBy]
    )
    const updated = rows[0]
    if (!updated) return null

    await client.query(
      `INSERT INTO case_timeline_entries (case_id, type, from_value, to_value, notes, performed_by)
       VALUES ($1, 'step_change', $2, $3, $4, $5)`,
      [id, fromStep, input.to_step_key, input.notes ?? null, updatedBy]
    )
    return updated
  })
}

// ─── closeCase ───────────────────────────────────────────────────────────────
export async function closeCase(
  id: string, orgId: string, input: CloseCaseInput, updatedBy: string
): Promise<Case | null> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Case>(
      `UPDATE cases
       SET status = 'closed', result = $3, result_type = $4,
           closed_at = now(), updated_by = $5, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, input.result, input.result_type, updatedBy]
    )
    const updated = rows[0]
    if (!updated) return null

    await client.query(
      `INSERT INTO case_timeline_entries (case_id, type, to_value, notes, performed_by)
       VALUES ($1, 'status_change', 'closed', $2, $3)`,
      [id, `${input.result_type}: ${input.result}${input.notes ? ' — ' + input.notes : ''}`, updatedBy]
    )
    return updated
  })
}

// ─── addTimelineNote ──────────────────────────────────────────────────────────
export async function addTimelineNote(
  caseId: string, input: AddTimelineNoteInput, performedBy: string
): Promise<CaseTimelineEntry> {
  const row = await queryOne<CaseTimelineEntry>(
    `INSERT INTO case_timeline_entries (case_id, type, notes, performed_by)
     VALUES ($1, 'note', $2, $3) RETURNING *`,
    [caseId, input.notes, performedBy]
  )
  if (!row) throw new Error('Timeline insert returned no row')
  return row
}

// ─── linkConversation ─────────────────────────────────────────────────────────
export async function linkConversationToCase(
  caseId: string, conversationId: string, orgId: string, updatedBy: string
): Promise<void> {
  await withTransaction(async (client) => {
    // Link conversation to case
    await client.query(
      `UPDATE conversations SET case_id = $1, updated_by = $2, updated_at = now()
       WHERE id = $3 AND org_id = $4`,
      [caseId, updatedBy, conversationId, orgId]
    )
    // Record in timeline
    await client.query(
      `INSERT INTO case_timeline_entries (case_id, type, to_value, notes, performed_by)
       VALUES ($1, 'system_event', $2, 'Conversación vinculada', $3)`,
      [caseId, conversationId, updatedBy]
    )
  })
}
