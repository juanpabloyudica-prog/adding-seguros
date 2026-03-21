import { createModuleLogger } from '../../shared/logger.js'
import { fireRulesForEvent } from '../automations/automations.service.js'
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors.js'
import { queryOne } from '../../infrastructure/db/client.js'
import {
  findPolicyById, listPolicies, createPolicy, renewPolicy,
  updatePolicy, updatePolicyStatus, updateRenewalStatus,
  getExpiringPolicies, getDashboardSummary,
} from './policies.repository.js'
import type { PolicyDetail } from './policies.repository.js'
import type {
  CreatePolicyInput, UpdatePolicyInput, UpdatePolicyStatusInput,
  RenewPolicyInput, UpdateRenewalStatusInput,
  ListPoliciesInput, ExpiringPoliciesInput,
  DashboardSummaryInput,
} from './policies.schema.js'
import type { Policy } from '@adding/types'

const log = createModuleLogger('policies.service')

// ─── Status transition rules ──────────────────────────────────────────────────
// 'expiring' is computed, not stored — transitions use stored values only.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:     ['active', 'cancelled'],
  active:    ['expired', 'cancelled'],
  expired:   [],         // terminal; renewed via POST /policies/:id/renew
  cancelled: [],         // terminal
}

// ─── FK guards ────────────────────────────────────────────────────────────────
async function assertPersonExists(personId: string, orgId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM persons WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL LIMIT 1`, [personId, orgId]
  )
  if (!row) throw new ValidationError(`Person '${personId}' not found in this organization`)
}

async function assertCompanyExists(companyId: string, orgId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM companies WHERE id=$1 AND org_id=$2 AND is_active=true LIMIT 1`, [companyId, orgId]
  )
  if (!row) throw new ValidationError(`Company '${companyId}' not found or inactive`)
}

async function assertProducerExists(producerId: string, orgId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM producers WHERE id=$1 AND org_id=$2 AND is_active=true LIMIT 1`, [producerId, orgId]
  )
  if (!row) throw new ValidationError(`Producer '${producerId}' not found or inactive`)
}

async function assertPolicyNumberUnique(
  orgId: string, companyId: string, policyNumber: string, excludeId?: string
) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM policies WHERE org_id=$1 AND company_id=$2 AND policy_number=$3 ${excludeId ? 'AND id!=$4' : ''} LIMIT 1`,
    excludeId ? [orgId, companyId, policyNumber, excludeId] : [orgId, companyId, policyNumber]
  )
  if (row) throw new ConflictError(`Policy number '${policyNumber}' already exists for this company`)
}

// ─── Service ──────────────────────────────────────────────────────────────────
export async function getPolicyById(id: string, orgId: string): Promise<PolicyDetail> {
  const policy = await findPolicyById(id, orgId)
  if (!policy) throw new NotFoundError('Policy', id)
  return policy
}

export async function getPolicies(orgId: string, params: ListPoliciesInput) {
  return listPolicies(orgId, params)
}

export async function getExpiringForAlerts(orgId: string, params: ExpiringPoliciesInput) {
  return getExpiringPolicies(orgId, params)
}

export async function createNewPolicy(orgId: string, input: CreatePolicyInput, createdBy: string): Promise<Policy> {
  await assertPersonExists(input.person_id, orgId)
  await assertCompanyExists(input.company_id, orgId)
  if (input.producer_id) await assertProducerExists(input.producer_id, orgId)
  await assertPolicyNumberUnique(orgId, input.company_id, input.policy_number)
  const policy = await createPolicy(orgId, input, createdBy)
  log.info({ policyId: policy.id, personId: input.person_id, orgId }, 'Policy created')
  return policy
}

export async function updateExistingPolicy(
  id: string, orgId: string, input: UpdatePolicyInput, updatedBy: string
): Promise<Policy> {
  const existing = await findPolicyById(id, orgId)
  if (!existing) throw new NotFoundError('Policy', id)
  if (input.producer_id) await assertProducerExists(input.producer_id, orgId)
  if (input.policy_number && input.policy_number !== existing.policy_number) {
    const companyId = (existing as unknown as { company_id: string }).company_id
    await assertPolicyNumberUnique(orgId, companyId, input.policy_number, id)
  }
  const updated = await updatePolicy(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Policy', id)
  log.info({ policyId: id, orgId, updatedBy }, 'Policy updated')
  return updated
}

export async function transitionPolicyStatus(
  id: string, orgId: string, input: UpdatePolicyStatusInput, updatedBy: string
): Promise<Policy> {
  const existing = await findPolicyById(id, orgId)
  if (!existing) throw new NotFoundError('Policy', id)
  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(input.status)) {
    throw new ValidationError(
      `Cannot transition from '${existing.status}' to '${input.status}'. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`
    )
  }
  const updated = await updatePolicyStatus(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Policy', id)
  log.info({ policyId: id, from: existing.status, to: input.status, orgId, updatedBy }, 'Policy status transitioned')
  return updated
}

export async function renewExistingPolicy(
  id: string, orgId: string, input: RenewPolicyInput, createdBy: string
): Promise<Policy> {
  const existing = await findPolicyById(id, orgId)
  if (!existing) throw new NotFoundError('Policy', id)
  // Only active or expired policies can be renewed
  if (!['active', 'expired'].includes(existing.status)) {
    throw new ValidationError(`Only active or expired policies can be renewed. Current status: '${existing.status}'`)
  }
  if (existing.renewal_status === 'renewed') {
    throw new ConflictError('This policy has already been renewed')
  }
  await assertPolicyNumberUnique(orgId, (existing as unknown as { company_id: string }).company_id, input.policy_number)
  const newPolicy = await renewPolicy(id, orgId, existing as unknown as Policy, input, createdBy)
  log.info({ oldPolicyId: id, newPolicyId: newPolicy.id, orgId, createdBy }, 'Policy renewed')

  // Fire automation rules for policy_renewed (non-blocking)
  fireRulesForEvent({
    orgId, triggerEvent: 'policy_renewed', policyId: newPolicy.id,
  }).catch(err => log.error({ err, policyId: newPolicy.id }, 'fireRulesForEvent failed for policy_renewed'))

  return newPolicy
}

export async function setRenewalStatus(
  id: string, orgId: string, input: UpdateRenewalStatusInput, updatedBy: string
): Promise<Policy> {
  const existing = await findPolicyById(id, orgId)
  if (!existing) throw new NotFoundError('Policy', id)
  const updated = await updateRenewalStatus(id, orgId, input.renewal_status, updatedBy)
  if (!updated) throw new NotFoundError('Policy', id)
  log.info({ policyId: id, renewalStatus: input.renewal_status, orgId }, 'Renewal status updated')
  return updated
}

export async function getPoliciesDashboardSummary(
  orgId: string,
  params: DashboardSummaryInput
) {
  return getDashboardSummary(orgId, params)
}
