import type { Person } from '@adding/types'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../shared/errors.js'
import { createModuleLogger } from '../../shared/logger.js'
import { queryOne } from '../../infrastructure/db/client.js'
import {
  findPersonById,
  listPersons,
  createPerson,
  updatePerson,
  softDeletePerson,
  checkDocumentExists,
  checkNamePhoneExists,
} from './persons.repository.js'
import type { PersonDetail } from './persons.repository.js'
import type {
  CreatePersonInput,
  UpdatePersonInput,
  ListPersonsInput,
} from './persons.schema.js'

const log = createModuleLogger('persons.service')

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertProducerBelongsToOrg(
  producerId: string,
  orgId: string
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM producers
     WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [producerId, orgId]
  )
  if (!row) {
    throw new ValidationError(
      `Producer '${producerId}' does not exist in this organization or is inactive`
    )
  }
}

async function assertUserBelongsToOrg(
  userId: string,
  orgId: string
): Promise<void> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM users
     WHERE id = $1 AND org_id = $2 AND is_active = true LIMIT 1`,
    [userId, orgId]
  )
  if (!row) {
    throw new ValidationError(
      `User '${userId}' does not exist in this organization or is inactive`
    )
  }
}

async function assertDocumentUnique(
  orgId: string,
  docType: string,
  docNumber: string,
  excludeId?: string
): Promise<void> {
  const exists = await checkDocumentExists(orgId, docType, docNumber, excludeId)
  if (exists) {
    log.warn(
      { orgId, docType, docNumberMasked: maskSensitive(docNumber) },
      'Duplicate person detected by document'
    )
    throw new ConflictError(
      `A person with ${docType} ${maskSensitive(docNumber)} already exists in this organization`
    )
  }
}


// Masks all but last 4 chars of a sensitive string for safe logging
function maskSensitive(value: string): string {
  if (value.length <= 4) return '****'
  return '*'.repeat(value.length - 4) + value.slice(-4)
}

async function assertNamePhoneUnique(
  orgId: string,
  fullName: string,
  phone: string,
  excludeId?: string
): Promise<void> {
  const existing = await checkNamePhoneExists(orgId, fullName, phone, excludeId)
  if (existing) {
    log.warn(
      {
        orgId,
        conflictPersonId: existing.id,
        phoneMasked: maskSensitive(phone),
        fullName,
      },
      'Duplicate person detected by name+phone'
    )
    throw new ConflictError(
      `A person named '${fullName}' with this phone number already exists in this organization`
    )
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getPersonById(
  id: string,
  orgId: string
): Promise<PersonDetail> {
  const person = await findPersonById(id, orgId)
  if (!person) throw new NotFoundError('Person', id)
  return person
}

export async function getPersons(orgId: string, params: ListPersonsInput) {
  return listPersons(orgId, params)
}

export async function createNewPerson(
  orgId: string,
  input: CreatePersonInput,
  createdBy: string
): Promise<Person> {
  if (input.producer_id) {
    await assertProducerBelongsToOrg(input.producer_id, orgId)
  }
  if (input.assigned_to_user_id) {
    await assertUserBelongsToOrg(input.assigned_to_user_id, orgId)
  }
  if (input.doc_type && input.doc_number) {
    await assertDocumentUnique(orgId, input.doc_type, input.doc_number)
  } else if (input.phone && input.full_name) {
    // No document provided: fall back to name+phone duplicate check
    await assertNamePhoneUnique(orgId, input.full_name, input.phone)
  }

  const person = await createPerson(orgId, input, createdBy)
  log.info({ personId: person.id, orgId, createdBy }, 'Person created')
  return person
}

export async function updateExistingPerson(
  id: string,
  orgId: string,
  input: UpdatePersonInput,
  updatedBy: string
): Promise<Person> {
  const existing = await findPersonById(id, orgId)
  if (!existing) throw new NotFoundError('Person', id)

  if (input.producer_id !== undefined && input.producer_id !== null) {
    await assertProducerBelongsToOrg(input.producer_id, orgId)
  }
  if (input.assigned_to_user_id !== undefined && input.assigned_to_user_id !== null) {
    await assertUserBelongsToOrg(input.assigned_to_user_id, orgId)
  }

  const newDocType   = input.doc_type   ?? existing.doc_type
  const newDocNumber = input.doc_number ?? existing.doc_number
  if (
    newDocType && newDocNumber &&
    (input.doc_type !== undefined || input.doc_number !== undefined)
  ) {
    await assertDocumentUnique(orgId, newDocType, newDocNumber, id)
  }

  const updated = await updatePerson(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Person', id)

  log.info({ personId: id, orgId, updatedBy }, 'Person updated')
  return updated
}

export async function deletePersonById(
  id: string,
  orgId: string,
  deletedBy: string
): Promise<void> {
  const existing = await findPersonById(id, orgId)
  if (!existing) throw new NotFoundError('Person', id)

  const deleted = await softDeletePerson(id, orgId, deletedBy)
  if (!deleted) throw new NotFoundError('Person', id)

  log.info({ personId: id, orgId, deletedBy }, 'Person soft-deleted')
}
