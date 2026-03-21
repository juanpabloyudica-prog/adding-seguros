import { createModuleLogger } from '../../shared/logger.js'
import { NotFoundError, ValidationError } from '../../shared/errors.js'
import { queryOne } from '../../infrastructure/db/client.js'
import {
  findRiskById, listRisks, listRisksByPerson,
  createRisk, updateRisk,
} from './risks.repository.js'
import type { CreateRiskInput, UpdateRiskInput, ListRisksInput } from './risks.schema.js'
import type { Risk } from '@adding/types'

const log = createModuleLogger('risks.service')

async function assertPersonBelongsToOrg(personId: string, orgId: string): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM persons WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [personId, orgId]
  )
  if (!row) throw new ValidationError(`Person '${personId}' not found in this organization`)
}

export async function getRiskById(id: string, orgId: string): Promise<Risk> {
  const risk = await findRiskById(id, orgId)
  if (!risk) throw new NotFoundError('Risk', id)
  return risk
}

export async function getRisks(orgId: string, params: ListRisksInput) {
  return listRisks(orgId, params)
}

export async function getRisksForPerson(personId: string, orgId: string): Promise<Risk[]> {
  await assertPersonBelongsToOrg(personId, orgId)
  return listRisksByPerson(personId, orgId)
}

export async function createNewRisk(
  orgId: string,
  input: CreateRiskInput,
  createdBy: string
): Promise<Risk> {
  await assertPersonBelongsToOrg(input.person_id, orgId)
  const risk = await createRisk(orgId, input, createdBy)
  log.info({ riskId: risk.id, personId: input.person_id, type: input.type, orgId }, 'Risk created')
  return risk
}

export async function updateExistingRisk(
  id: string,
  orgId: string,
  input: UpdateRiskInput,
  updatedBy: string
): Promise<Risk> {
  const existing = await findRiskById(id, orgId)
  if (!existing) throw new NotFoundError('Risk', id)

  const updated = await updateRisk(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Risk', id)

  log.info({ riskId: id, orgId, updatedBy }, 'Risk updated')
  return updated
}
