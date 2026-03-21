import { queryOne, queryMany } from '../../infrastructure/db/client.js'
import { AppError } from '../../shared/errors.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Company } from '@adding/types'
import type { CreateCompanyInput, UpdateCompanyInput, ListCompaniesInput } from './companies.schema.js'

export interface CompanyDetail extends Company {
  metadata: {
    active_policy_count: number
    quote_option_count:  number
  }
}

// ─── findCompanyById ──────────────────────────────────────────────────────────
export async function findCompanyById(id: string, orgId: string): Promise<CompanyDetail | null> {
  return queryOne<CompanyDetail>(
    `SELECT c.*,
       json_build_object(
         'active_policy_count',
           (SELECT COUNT(*) FROM policies WHERE company_id = c.id AND status = 'active'),
         'quote_option_count',
           (SELECT COUNT(*) FROM quote_options WHERE company_id = c.id)
       ) AS metadata
     FROM companies c
     WHERE c.id = $1 AND c.org_id = $2
     LIMIT 1`,
    [id, orgId]
  )
}

// ─── listCompanies ────────────────────────────────────────────────────────────
export async function listCompanies(orgId: string, params: ListCompaniesInput) {
  const { page, limit, search, is_active, multicotizador } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR short_name ILIKE $${idx})`)
    values.push(`%${search}%`)
    idx++
  }
  if (is_active !== undefined) {
    conditions.push(`is_active = $${idx}`)
    values.push(is_active)
    idx++
  }
  if (multicotizador !== undefined) {
    conditions.push(`multicotizador = $${idx}`)
    values.push(multicotizador)
    idx++
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM companies WHERE ${whereClause}`, values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<Company>(
    `SELECT * FROM companies WHERE ${whereClause}
     ORDER BY ranking DESC NULLS LAST, name ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

// ─── createCompany ────────────────────────────────────────────────────────────
export async function createCompany(
  orgId: string,
  input: CreateCompanyInput,
  createdBy: string
): Promise<Company> {
  const row = await queryOne<Company>(
    `INSERT INTO companies
       (org_id, name, short_name, logo_url,
        login_url, emision_url, siniestros_url, consulta_poliza_url,
        multicotizador, ranking, notes, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)
     RETURNING *`,
    [
      orgId,
      input.name,
      input.short_name           ?? null,
      input.logo_url             ?? null,
      input.login_url            ?? null,
      input.emision_url          ?? null,
      input.siniestros_url       ?? null,
      input.consulta_poliza_url  ?? null,
      input.multicotizador       ?? false,
      input.ranking              ?? null,
      input.notes                ?? null,
      createdBy,
    ]
  )
  if (!row) throw new AppError('COMPANY_INSERT_FAILED', 'Insert returned no row', 500)
  return row
}

// ─── updateCompany ────────────────────────────────────────────────────────────
export async function updateCompany(
  id: string,
  orgId: string,
  input: UpdateCompanyInput,
  updatedBy: string
): Promise<Company | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[]    = [id, orgId, updatedBy]
  let idx = 4

  const fields: (keyof UpdateCompanyInput)[] = [
    'name','short_name','logo_url','login_url','emision_url',
    'siniestros_url','consulta_poliza_url','multicotizador','ranking','notes','is_active',
  ]
  for (const field of fields) {
    if (input[field] !== undefined) {
      setClauses.push(`${field} = $${idx}`)
      values.push(input[field])
      idx++
    }
  }

  return queryOne<Company>(
    `UPDATE companies SET ${setClauses.join(', ')}
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}
