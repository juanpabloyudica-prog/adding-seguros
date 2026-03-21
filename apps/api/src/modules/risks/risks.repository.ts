import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import { AppError } from '../../shared/errors.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Risk } from '@adding/types'
import type { CreateRiskInput, UpdateRiskInput, ListRisksInput } from './risks.schema.js'

// ─── findRiskById ─────────────────────────────────────────────────────────────
export async function findRiskById(id: string, orgId: string): Promise<Risk | null> {
  return queryOne<Risk>(
    `SELECT r.*, json_build_object('id', p.id, 'full_name', p.full_name) AS person
     FROM risks r
     JOIN persons p ON p.id = r.person_id
     WHERE r.id = $1 AND r.org_id = $2
     LIMIT 1`,
    [id, orgId]
  )
}

// ─── listRisks ────────────────────────────────────────────────────────────────
export async function listRisks(orgId: string, params: ListRisksInput) {
  const { page, limit, person_id, type } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['r.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (person_id) {
    conditions.push(`r.person_id = $${idx}`)
    values.push(person_id)
    idx++
  }
  if (type) {
    conditions.push(`r.type = $${idx}`)
    values.push(type)
    idx++
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM risks r WHERE ${whereClause}`, values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<Risk>(
    `SELECT r.*,
       json_build_object('id', p.id, 'full_name', p.full_name) AS person
     FROM risks r
     JOIN persons p ON p.id = r.person_id
     WHERE ${whereClause}
     ORDER BY r.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── listRisksByPerson ────────────────────────────────────────────────────────
// Convenience for GET /persons/:personId/risks
export async function listRisksByPerson(personId: string, orgId: string): Promise<Risk[]> {
  return queryMany<Risk>(
    `SELECT * FROM risks
     WHERE person_id = $1 AND org_id = $2
     ORDER BY created_at DESC`,
    [personId, orgId]
  )
}

// ─── createRisk ───────────────────────────────────────────────────────────────
export async function createRisk(
  orgId: string,
  input: CreateRiskInput,
  createdBy: string
): Promise<Risk> {
  const row = await queryOne<Risk>(
    `INSERT INTO risks (org_id, person_id, type, data, description, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [
      orgId,
      input.person_id,
      input.type,
      JSON.stringify(input.data),
      input.description ?? null,
      createdBy,
    ]
  )
  if (!row) throw new AppError('RISK_INSERT_FAILED', 'Insert returned no row', 500)
  return row
}

// ─── updateRisk ───────────────────────────────────────────────────────────────
export async function updateRisk(
  id: string,
  orgId: string,
  input: UpdateRiskInput,
  updatedBy: string
): Promise<Risk | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[]    = [id, orgId, updatedBy]
  let idx = 4

  if (input.data !== undefined) {
    // Merge with existing data rather than replace — preserves fields not sent
    setClauses.push(`data = data || $${idx}::jsonb`)
    values.push(JSON.stringify(input.data))
    idx++
  }
  if (input.description !== undefined) {
    setClauses.push(`description = $${idx}`)
    values.push(input.description)
    idx++
  }

  return queryOne<Risk>(
    `UPDATE risks SET ${setClauses.join(', ')}
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}
