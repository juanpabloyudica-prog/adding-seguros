import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import type { Person } from '@adding/types'
import type { CreatePersonInput, UpdatePersonInput, ListPersonsInput } from './persons.schema.js'
import { buildPaginatedResponse } from '@adding/utils'

// ─── Row shapes ───────────────────────────────────────────────────────────────
type PersonRow = Person

// Full enriched shape returned by GET /:id
// Includes producer, assigned_to, and metadata stubs for future extension.
export interface PersonDetail extends Person {
  producer: {
    id: string
    user_id: string
    full_name: string
    specialties: string[]
    signature_text: string | null
    is_active: boolean
  } | null
  assigned_to: {
    id: string
    full_name: string
    email: string
    role: string
  } | null
  // Counts populated by JOIN — ready for frontend to decide whether to fetch details
  metadata: {
    policy_count:       number
    open_case_count:    number
    conversation_count: number
    document_count:     number
  }
}

interface ListResult {
  data: PersonRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Shared active-row filter ─────────────────────────────────────────────────
// All queries must append this — the RLS policy also enforces it but the
// explicit filter makes queries self-documenting and faster via partial indexes.
const ACTIVE = 'deleted_at IS NULL'

// ─── findPersonById — enriched ────────────────────────────────────────────────
export async function findPersonById(
  id: string,
  orgId: string
): Promise<PersonDetail | null> {
  return queryOne<PersonDetail>(
    `SELECT
       p.*,
       -- Producer (full profile via join on users for the name)
       CASE WHEN pr.id IS NOT NULL THEN
         json_build_object(
           'id',             pr.id,
           'user_id',        pr.user_id,
           'full_name',      pu.full_name,
           'specialties',    pr.specialties,
           'signature_text', pr.signature_text,
           'is_active',      pr.is_active
         )
       END AS producer,
       -- Assigned operativo
       CASE WHEN u.id IS NOT NULL THEN
         json_build_object(
           'id',        u.id,
           'full_name', u.full_name,
           'email',     u.email,
           'role',      u.role
         )
       END AS assigned_to,
       -- Metadata counts for frontend context (no details fetched yet)
       json_build_object(
         'policy_count',
           (SELECT COUNT(*) FROM policies
            WHERE person_id = p.id AND status != 'cancelled'),
         'open_case_count',
           (SELECT COUNT(*) FROM cases
            WHERE person_id = p.id AND status NOT IN ('closed', 'cancelled')),
         'conversation_count',
           (SELECT COUNT(*) FROM conversations
            WHERE person_id = p.id AND status != 'closed'),
         'document_count',
           (SELECT COUNT(*) FROM documents
            WHERE entity_type = 'person' AND entity_id = p.id)
       ) AS metadata
     FROM persons p
     LEFT JOIN producers pr ON pr.id  = p.producer_id
     LEFT JOIN users pu     ON pu.id  = pr.user_id
     LEFT JOIN users u      ON u.id   = p.assigned_to_user_id
     WHERE p.id = $1
       AND p.org_id = $2
       AND p.${ACTIVE}
     LIMIT 1`.replace('${ACTIVE}', ACTIVE),
    [id, orgId]
  )
}

// ─── listPersons ──────────────────────────────────────────────────────────────
export async function listPersons(
  orgId: string,
  params: ListPersonsInput
): Promise<ListResult> {
  const { page, limit, search, producer_id, assigned_to_user_id, is_company, tags } = params
  const offset = (page - 1) * limit

  const conditions: string[] = [`p.org_id = $1`, `p.${ACTIVE}`.replace('${ACTIVE}', ACTIVE)]
  const values: unknown[] = [orgId]
  let idx = 2

  if (search) {
    conditions.push(
      `(p.full_name ILIKE $${idx} OR p.doc_number ILIKE $${idx} OR p.phone ILIKE $${idx})`
    )
    values.push(`%${search}%`)
    idx++
  }

  if (producer_id) {
    conditions.push(`p.producer_id = $${idx}`)
    values.push(producer_id)
    idx++
  }

  if (assigned_to_user_id) {
    conditions.push(`p.assigned_to_user_id = $${idx}`)
    values.push(assigned_to_user_id)
    idx++
  }

  if (is_company !== undefined) {
    conditions.push(`p.is_company = $${idx}`)
    values.push(is_company)
    idx++
  }

  if (tags) {
    const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (tagArray.length > 0) {
      conditions.push(`p.tags @> $${idx}`)
      values.push(tagArray)
      idx++
    }
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM persons p WHERE ${whereClause}`,
    values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<PersonRow>(
    `SELECT
       p.*,
       CASE WHEN pr.id IS NOT NULL THEN
         json_build_object(
           'id',        pr.id,
           'user_id',   pr.user_id,
           'full_name', pu.full_name
         )
       END AS producer,
       CASE WHEN u.id IS NOT NULL THEN
         json_build_object(
           'id',        u.id,
           'full_name', u.full_name,
           'email',     u.email
         )
       END AS assigned_to
     FROM persons p
     LEFT JOIN producers pr ON pr.id  = p.producer_id
     LEFT JOIN users pu     ON pu.id  = pr.user_id
     LEFT JOIN users u      ON u.id   = p.assigned_to_user_id
     WHERE ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── createPerson ─────────────────────────────────────────────────────────────
export async function createPerson(
  orgId: string,
  input: CreatePersonInput,
  createdBy: string
): Promise<PersonRow> {
  const row = await queryOne<PersonRow>(
    `INSERT INTO persons (
       org_id, producer_id, assigned_to_user_id,
       full_name, doc_type, doc_number,
       phone, email, birthdate, gender,
       address, is_company, tags, notes,
       created_by, updated_by
     ) VALUES (
       $1,  $2,  $3,
       $4,  $5,  $6,
       $7,  $8,  $9,  $10,
       $11, $12, $13, $14,
       $15, $15
     )
     RETURNING *`,
    [
      orgId,
      input.producer_id         ?? null,
      input.assigned_to_user_id ?? null,
      input.full_name,
      input.doc_type            ?? null,
      input.doc_number          ?? null,
      input.phone               ?? null,
      input.email               ?? null,
      input.birthdate           ?? null,
      input.gender              ?? null,
      input.address ? JSON.stringify(input.address) : null,
      input.is_company          ?? false,
      input.tags                ?? [],
      input.notes               ?? null,
      createdBy,
    ]
  )
  if (!row) throw new Error('Insert returned no row')
  return row
}

// ─── updatePerson ─────────────────────────────────────────────────────────────
export async function updatePerson(
  id: string,
  orgId: string,
  input: UpdatePersonInput,
  updatedBy: string
): Promise<PersonRow | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[]    = [id, orgId, updatedBy]
  let idx = 4

  const fieldMap: Record<keyof UpdatePersonInput, string> = {
    full_name:           'full_name',
    doc_type:            'doc_type',
    doc_number:          'doc_number',
    phone:               'phone',
    email:               'email',
    birthdate:           'birthdate',
    gender:              'gender',
    address:             'address',
    is_company:          'is_company',
    tags:                'tags',
    notes:               'notes',
    producer_id:         'producer_id',
    assigned_to_user_id: 'assigned_to_user_id',
  }

  for (const [key, column] of Object.entries(fieldMap)) {
    const typedKey = key as keyof UpdatePersonInput
    if (input[typedKey] !== undefined) {
      const val = input[typedKey]
      setClauses.push(`${column} = $${idx}`)
      values.push(column === 'address' && val !== null ? JSON.stringify(val) : val)
      idx++
    }
  }

  if (setClauses.length === 2) {
    return findPersonById(id, orgId)
  }

  return queryOne<PersonRow>(
    `UPDATE persons
     SET ${setClauses.join(', ')}
     WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
     RETURNING *`,
    values
  )
}

// ─── softDeletePerson ─────────────────────────────────────────────────────────
// Sets deleted_at + deleted_by. The row is retained for audit and FK purposes.
// The partial unique index on (org_id, doc_type, doc_number) excludes deleted
// rows, so the same document can be re-registered after a soft delete.
export async function softDeletePerson(
  id: string,
  orgId: string,
  deletedBy: string
): Promise<boolean> {
  const result = await queryOne<{ id: string }>(
    `UPDATE persons
     SET deleted_at = now(),
         deleted_by = $3,
         updated_at = now(),
         updated_by = $3
     WHERE id = $1
       AND org_id = $2
       AND deleted_at IS NULL
     RETURNING id`,
    [id, orgId, deletedBy]
  )
  return result !== null
}

// ─── checkDocumentExists ──────────────────────────────────────────────────────
export async function checkDocumentExists(
  orgId: string,
  docType: string,
  docNumber: string,
  excludeId?: string
): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM persons
     WHERE org_id = $1
       AND doc_type = $2
       AND doc_number = $3
       AND deleted_at IS NULL
       ${excludeId ? 'AND id != $4' : ''}
     LIMIT 1`,
    excludeId
      ? [orgId, docType, docNumber, excludeId]
      : [orgId, docType, docNumber]
  )
  return row !== null
}

// ─── findPersonByPhone ────────────────────────────────────────────────────────
// Used by conversation service to link an incoming WA number to a known person.
export async function findPersonByPhone(
  orgId: string,
  phone: string
): Promise<PersonRow | null> {
  return queryOne<PersonRow>(
    `SELECT * FROM persons
     WHERE org_id = $1
       AND phone = $2
       AND deleted_at IS NULL
     LIMIT 1`,
    [orgId, phone]
  )
}

// ─── checkNamePhoneExists ─────────────────────────────────────────────────────
// Fallback duplicate check for persons without a document.
// Matches on normalized full_name (case-insensitive, trimmed) + phone
// within the same org, excluding soft-deleted rows.
// Only used when doc_type + doc_number are absent.
export async function checkNamePhoneExists(
  orgId: string,
  fullName: string,
  phone: string,
  excludeId?: string
): Promise<{ id: string; full_name: string } | null> {
  return queryOne<{ id: string; full_name: string }>(
    `SELECT id, full_name FROM persons
     WHERE org_id = $1
       AND LOWER(TRIM(full_name)) = LOWER(TRIM($2))
       AND phone = $3
       AND deleted_at IS NULL
       ${excludeId ? 'AND id != $4' : ''}
     LIMIT 1`,
    excludeId
      ? [orgId, fullName, phone, excludeId]
      : [orgId, fullName, phone]
  )
}
