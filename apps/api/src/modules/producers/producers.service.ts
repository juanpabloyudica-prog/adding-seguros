import { createModuleLogger } from '../../shared/logger.js'
import { queryOne } from '../../infrastructure/db/client.js'
import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors.js'
import {
  findProducerById,
  findProducerByUserId,
  listProducers,
  createProducer,
  updateProducer,
} from './producers.repository.js'
import type { ProducerDetail } from './producers.repository.js'
import type { CreateProducerInput, UpdateProducerInput, ListProducersInput } from './producers.schema.js'
import type { Producer } from '@adding/types'

const log = createModuleLogger('producers.service')

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertUserIsProductor(userId: string, orgId: string): Promise<void> {
  const row = await queryOne<{ role: string }>(
    `SELECT role FROM users WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [userId, orgId]
  )
  if (!row) throw new ValidationError(`User '${userId}' not found in this organization`)
  if (row.role !== 'productor') {
    throw new ValidationError(
      `User '${userId}' has role '${row.role}'. Only users with role 'productor' can be registered as producers.`
    )
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getProducerById(id: string, orgId: string): Promise<ProducerDetail> {
  const producer = await findProducerById(id, orgId)
  if (!producer) throw new NotFoundError('Producer', id)
  return producer
}

export async function getProducers(orgId: string, params: ListProducersInput) {
  return listProducers(orgId, params)
}

export async function createNewProducer(
  orgId: string,
  input: CreateProducerInput,
  createdBy: string
): Promise<Producer> {
  // The referenced user must exist in this org with role='productor'
  await assertUserIsProductor(input.user_id, orgId)

  // One producer profile per user
  const existing = await findProducerByUserId(input.user_id, orgId)
  if (existing) {
    log.warn({ userId: input.user_id, orgId, existingId: existing.id }, 'Duplicate producer profile attempt')
    throw new ConflictError(`A producer profile already exists for this user`)
  }

  const producer = await createProducer(orgId, input, createdBy)
  log.info({ producerId: producer.id, userId: input.user_id, orgId }, 'Producer created')
  return producer
}

export async function updateExistingProducer(
  id: string,
  orgId: string,
  input: UpdateProducerInput,
  updatedBy: string
): Promise<Producer> {
  const existing = await findProducerById(id, orgId)
  if (!existing) throw new NotFoundError('Producer', id)

  const updated = await updateProducer(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Producer', id)

  log.info({ producerId: id, orgId, updatedBy }, 'Producer updated')
  return updated
}
