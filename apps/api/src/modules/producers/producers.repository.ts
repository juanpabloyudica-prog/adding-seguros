import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Producer } from '@adding/types'
import type { CreateProducerInput, UpdateProducerInput, ListProducersInput } from './producers.schema.js'

type ProducerRow = Producer

export interface ProducerDetail extends Producer {
  user: {
    id: string
    full_name: string
    email: string
    phone: string | null
    role: string
    is_active: boolean
  }
  metadata: {
    person_count:        number
    active_policy_count: number
    open_case_count:     number
  }
}

// ─── findProducerById ─────────────────────────────────────────────────────────
export async function findProducerById(
  id: string,
  orgId: string
): Promise<ProducerDetail | null> {
  return queryOne<ProducerDetail>(
    `SELECT
       p.*,
       json_build_object(
         'id',        u.id,
         'full_name', u.full_name,
         'email',     u.email,
         'phone',     u.phone,
         'role',      u.role,
         'is_active', u.is_active
       ) AS "user",
       json_build_object(
         'person_count',
           (SELECT COUNT(*) FROM persons
            WHERE producer_id = p.id AND deleted_at IS NULL),
         'active_policy_count',
           (SELECT COUNT(*) FROM policies
            WHERE producer_id = p.id AND status = 'active'),
         'open_case_count',
           (SELECT COUNT(*) FROM cases
            WHERE producer_id = p.id AND status NOT IN ('closed','cancelled'))
       ) AS metadata
     FROM producers p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1 AND p.org_id = $2
     LIMIT 1`,
    [id, orgId]
  )
}

// ─── findProducerByUserId ─────────────────────────────────────────────────────
export async function findProducerByUserId(
  userId: string,
  orgId: string
): Promise<ProducerRow | null> {
  return queryOne<ProducerRow>(
    `SELECT * FROM producers WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
    [userId, orgId]
  )
}

// ─── listProducers ────────────────────────────────────────────────────────────
export async function listProducers(orgId: string, params: ListProducersInput) {
  const { page, limit, search, is_active, specialty } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['p.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (search) {
    conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx} OR p.license_number ILIKE $${idx})`)
    values.push(`%${search}%`)
    idx++
  }
  if (is_active !== undefined) {
    conditions.push(`p.is_active = $${idx}`)
    values.push(is_active)
    idx++
  }
  if (specialty) {
    conditions.push(`p.specialties @> $${idx}`)
    values.push([specialty])
    idx++
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM producers p JOIN users u ON u.id = p.user_id WHERE ${whereClause}`,
    values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<ProducerRow>(
    `SELECT p.*,
       json_build_object(
         'id', u.id, 'full_name', u.full_name, 'email', u.email, 'role', u.role
       ) AS "user"
     FROM producers p
     JOIN users u ON u.id = p.user_id
     WHERE ${whereClause}
     ORDER BY u.full_name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── createProducer ───────────────────────────────────────────────────────────
export async function createProducer(
  orgId: string,
  input: CreateProducerInput,
  createdBy: string
): Promise<ProducerRow> {
  const row = await queryOne<ProducerRow>(
    `INSERT INTO producers
       (org_id, user_id, license_number, specialties, signature_text, bio, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING *`,
    [
      orgId,
      input.user_id,
      input.license_number ?? null,
      input.specialties    ?? [],
      input.signature_text ?? null,
      input.bio            ?? null,
      createdBy,
    ]
  )
  if (!row) throw new Error('Insert returned no row')
  return row
}

// ─── updateProducer ───────────────────────────────────────────────────────────
export async function updateProducer(
  id: string,
  orgId: string,
  input: UpdateProducerInput,
  updatedBy: string
): Promise<ProducerRow | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[]    = [id, orgId, updatedBy]
  let idx = 4

  const fieldMap: Record<keyof UpdateProducerInput, string> = {
    license_number: 'license_number',
    specialties:    'specialties',
    signature_text: 'signature_text',
    bio:            'bio',
    is_active:      'is_active',
  }

  for (const [key, column] of Object.entries(fieldMap)) {
    const k = key as keyof UpdateProducerInput
    if (input[k] !== undefined) {
      setClauses.push(`${column} = $${idx}`)
      values.push(input[k])
      idx++
    }
  }

  return queryOne<ProducerRow>(
    `UPDATE producers SET ${setClauses.join(', ')}
     WHERE id = $1 AND org_id = $2
     RETURNING *`,
    values
  )
}
