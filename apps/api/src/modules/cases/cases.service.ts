import { createModuleLogger } from '../../shared/logger.js'
import { fireRulesForEvent } from '../automations/automations.service.js'
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js'
import { queryOne } from '../../infrastructure/db/client.js'
import {
  findCaseById, listCases, createCase, updateCase,
  transitionCaseStatus, transitionCaseStep, closeCase,
  addTimelineNote, linkConversationToCase,
} from './cases.repository.js'
import type { CaseDetail } from './cases.repository.js'
import type {
  CreateCaseInput, UpdateCaseInput, TransitionCaseStatusInput,
  TransitionStepInput, CloseCaseInput, AddTimelineNoteInput,
  LinkConversationInput, ListCasesInput,
} from './cases.schema.js'
import type { Case } from '@adding/types'

const log = createModuleLogger('cases.service')

// ─── Allowed status transitions ───────────────────────────────────────────────
const STATUS_TRANSITIONS: Record<string, string[]> = {
  open:            ['in_progress','waiting_client','waiting_company','escalated','cancelled'],
  in_progress:     ['waiting_client','waiting_company','escalated','resolved','closed','cancelled'],
  waiting_client:  ['in_progress','resolved','closed','cancelled'],
  waiting_company: ['in_progress','resolved','closed','cancelled'],
  escalated:       ['in_progress','resolved','closed','cancelled'],
  resolved:        ['closed','in_progress'],
  closed:          [],   // terminal
  cancelled:       [],   // terminal
}

// ─── Guards ───────────────────────────────────────────────────────────────────
async function assertPersonExists(personId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM persons WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [personId, orgId]
  )
  if (!row) throw new ValidationError(`Person '${personId}' not found`)
}

async function assertPolicyBelongsToOrg(policyId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM policies WHERE id=$1 AND org_id=$2 LIMIT 1`,
    [policyId, orgId]
  )
  if (!row) throw new ValidationError(`Policy '${policyId}' not found`)
}

async function assertProducerExists(producerId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM producers WHERE id=$1 AND org_id=$2 AND is_active=true LIMIT 1`,
    [producerId, orgId]
  )
  if (!row) throw new ValidationError(`Producer '${producerId}' not found or inactive`)
}

async function assertUserExists(userId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM users WHERE id=$1 AND org_id=$2 AND is_active=true LIMIT 1`,
    [userId, orgId]
  )
  if (!row) throw new ValidationError(`User '${userId}' not found`)
}

async function assertConversationExists(convId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM conversations WHERE id=$1 AND org_id=$2 LIMIT 1`,
    [convId, orgId]
  )
  if (!row) throw new ValidationError(`Conversation '${convId}' not found`)
}

// ─── Service ──────────────────────────────────────────────────────────────────
export async function getCaseById(id: string, orgId: string): Promise<CaseDetail> {
  const c = await findCaseById(id, orgId)
  if (!c) throw new NotFoundError('Case', id)
  return c
}

export async function getCases(orgId: string, params: ListCasesInput) {
  return listCases(orgId, params)
}

export async function createNewCase(
  orgId: string, input: CreateCaseInput, createdBy: string
): Promise<Case> {
  await assertPersonExists(input.person_id, orgId)
  if (input.policy_id)           await assertPolicyBelongsToOrg(input.policy_id, orgId)
  if (input.producer_id)         await assertProducerExists(input.producer_id, orgId)
  if (input.assigned_to_user_id) await assertUserExists(input.assigned_to_user_id, orgId)

  const c = await createCase(orgId, input, createdBy)
  log.info({ caseId: c.id, type: input.type, personId: input.person_id, orgId }, 'Case created')

  // Fire automation rules for case_created event (fire-and-forget)
  fireRulesForEvent({
    orgId,
    triggerEvent: 'case_created',
    caseId:       c.id,
    variables: {
      tipo_caso:   input.type,
      titulo_caso: input.title,
    },
    systemUserId: createdBy,
  }).catch(err => log.error({ err, caseId: c.id }, 'fireRulesForEvent failed for case_created'))

  return c
}

export async function updateExistingCase(
  id: string, orgId: string, input: UpdateCaseInput, updatedBy: string
): Promise<Case> {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)
  if (existing.status === 'closed' || existing.status === 'cancelled') {
    throw new ValidationError(`Cannot update a ${existing.status} case`)
  }

  if (input.producer_id)          await assertProducerExists(input.producer_id, orgId)
  if (input.assigned_to_user_id)  await assertUserExists(input.assigned_to_user_id, orgId)
  if (input.escalated_to_user_id) await assertUserExists(input.escalated_to_user_id, orgId)

  const updated = await updateCase(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Case', id)

  log.info({ caseId: id, orgId, updatedBy }, 'Case updated')
  return updated
}

export async function transitionStatus(
  id: string, orgId: string,
  input: TransitionCaseStatusInput,
  updatedBy: string
): Promise<Case> {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)

  const allowed = STATUS_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(input.status)) {
    throw new ValidationError(
      `Cannot transition from '${existing.status}' to '${input.status}'. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none (terminal)'}`
    )
  }

  const updated = await transitionCaseStatus(id, orgId, input, updatedBy, existing.status)
  if (!updated) throw new NotFoundError('Case', id)

  log.info({ caseId: id, from: existing.status, to: input.status, orgId }, 'Case status transitioned')

  // Fire automation rules for status change events (fire-and-forget)
  const event = input.status === 'closed' ? 'case_closed' : 'case_status_changed'
  fireRulesForEvent({
    orgId,
    triggerEvent: event,
    caseId:       id,
    variables: {
      estado_anterior: existing.status,
      estado_nuevo:    input.status,
    },
    systemUserId: updatedBy,
  }).catch(err => log.error({ err, caseId: id }, `fireRulesForEvent failed for ${event}`))

  return updated
}

export async function transitionStep(
  id: string, orgId: string,
  input: TransitionStepInput,
  updatedBy: string
): Promise<Case> {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)

  if (!existing.workflow) {
    throw new ValidationError('This case has no workflow assigned')
  }

  // Validate the transition is allowed
  const currentStep = existing.workflow.steps.find(s => s.key === existing.current_step_key)
  if (currentStep && !currentStep.allowed_transitions.includes(input.to_step_key)) {
    const allowed = currentStep.allowed_transitions
    throw new ValidationError(
      `Step '${existing.current_step_key}' cannot transition to '${input.to_step_key}'. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}`
    )
  }

  const updated = await transitionCaseStep(id, orgId, input, updatedBy, existing.current_step_key)
  if (!updated) throw new NotFoundError('Case', id)

  log.info({ caseId: id, from: existing.current_step_key, to: input.to_step_key, orgId }, 'Case step transitioned')
  return updated
}

export async function closeCaseById(
  id: string, orgId: string, input: CloseCaseInput, updatedBy: string
): Promise<Case> {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)

  if (existing.status === 'closed') throw new ConflictError('Case is already closed')
  if (existing.status === 'cancelled') throw new ValidationError('Cannot close a cancelled case')

  const updated = await closeCase(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Case', id)

  log.info({ caseId: id, resultType: input.result_type, orgId, updatedBy }, 'Case closed')
  return updated
}

export async function addNote(
  id: string, orgId: string, input: AddTimelineNoteInput, userId: string
) {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)

  return addTimelineNote(id, input, userId)
}

export async function linkConversation(
  id: string, orgId: string, input: LinkConversationInput, userId: string
) {
  const existing = await findCaseById(id, orgId)
  if (!existing) throw new NotFoundError('Case', id)

  await assertConversationExists(input.conversation_id, orgId)
  await linkConversationToCase(id, input.conversation_id, orgId, userId)

  log.info({ caseId: id, conversationId: input.conversation_id, orgId }, 'Conversation linked to case')
}
