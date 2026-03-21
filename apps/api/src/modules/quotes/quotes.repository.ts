import { queryOne, queryMany, withTransaction } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse } from '@adding/utils'
import type { Quote, QuoteOption } from '@adding/types'
import type {
  CreateQuoteInput, UpdateQuoteInput, AddQuoteOptionInput,
  UpdateQuoteOptionInput, SelectOptionInput, MarkSentInput, ListQuotesInput,
} from './quotes.schema.js'

export interface QuoteDetail extends Quote {
  person:     { id: string; full_name: string; phone: string | null } | null
  risk:       { id: string; type: string; data: Record<string, unknown> } | null
  producer:   { id: string; full_name: string } | null
  options:    (QuoteOption & { company: { id: string; name: string; short_name: string | null; logo_url: string | null } | null })[]
}

const QUOTE_SELECT = `
  q.*,
  json_build_object('id', pe.id, 'full_name', pe.full_name, 'phone', pe.phone) AS person,
  json_build_object('id', r.id, 'type', r.type, 'data', r.data) AS risk,
  CASE WHEN pr.id IS NOT NULL THEN
    json_build_object('id', pr.id, 'full_name', pu.full_name)
  END AS producer
`

const QUOTE_JOINS = `
  JOIN persons pe    ON pe.id = q.person_id
  JOIN risks r       ON r.id  = q.risk_id
  LEFT JOIN producers pr ON pr.id = q.producer_id
  LEFT JOIN users pu     ON pu.id = pr.user_id
`

export async function findQuoteById(id: string, orgId: string): Promise<QuoteDetail | null> {
  const row = await queryOne<Quote>(
    `SELECT ${QUOTE_SELECT} FROM quotes q ${QUOTE_JOINS}
     WHERE q.id = $1 AND q.org_id = $2 LIMIT 1`,
    [id, orgId]
  )
  if (!row) return null

  const options = await queryMany<QuoteOption & { company: unknown }>(
    `SELECT qo.*,
       json_build_object('id', co.id, 'name', co.name, 'short_name', co.short_name, 'logo_url', co.logo_url) AS company
     FROM quote_options qo
     JOIN companies co ON co.id = qo.company_id
     WHERE qo.quote_id = $1
     ORDER BY qo.sort_order ASC, qo.premium ASC`,
    [id]
  )

  return { ...(row as unknown as QuoteDetail), options: options as QuoteDetail['options'] }
}

export async function listQuotes(orgId: string, params: ListQuotesInput) {
  const { page, limit, person_id, status, producer_id, search } = params
  const offset = (page - 1) * limit

  const conditions: string[] = ['q.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (person_id)   { conditions.push(`q.person_id = $${idx}`);   values.push(person_id);   idx++ }
  if (status)      { conditions.push(`q.status = $${idx}`);      values.push(status);      idx++ }
  if (producer_id) { conditions.push(`q.producer_id = $${idx}`); values.push(producer_id); idx++ }
  if (search) {
    conditions.push(`(pe.full_name ILIKE $${idx})`)
    values.push(`%${search}%`); idx++
  }

  const whereClause = conditions.join(' AND ')

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM quotes q ${QUOTE_JOINS} WHERE ${whereClause}`, values
  )
  const total = parseInt(countResult?.count ?? '0', 10)

  const rows = await queryMany<Quote>(
    `SELECT ${QUOTE_SELECT},
       (SELECT COUNT(*) FROM quote_options WHERE quote_id = q.id)::int AS option_count,
       (SELECT COUNT(*) FROM quote_options WHERE quote_id = q.id AND is_sent_to_client = true)::int AS sent_count
     FROM quotes q ${QUOTE_JOINS}
     WHERE ${whereClause}
     ORDER BY q.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )

  return buildPaginatedResponse(rows, total, page, limit)
}

export async function createQuote(
  orgId: string, input: CreateQuoteInput, createdBy: string
): Promise<Quote> {
  const row = await queryOne<Quote>(
    `INSERT INTO quotes
       (org_id, person_id, risk_id, producer_id, assigned_to_user_id,
        internal_recommendation, notes, status, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$8)
     RETURNING *`,
    [
      orgId, input.person_id, input.risk_id,
      input.producer_id ?? null, input.assigned_to_user_id ?? null,
      input.internal_recommendation ?? null, input.notes ?? null, createdBy,
    ]
  )
  if (!row) throw new AppError('QUOTE_INSERT_FAILED', 'Quote insert returned no row', 500)
  return row
}

export async function updateQuote(
  id: string, orgId: string, input: UpdateQuoteInput, updatedBy: string
): Promise<Quote | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[] = [id, orgId, updatedBy]
  let idx = 4

  const fields: (keyof UpdateQuoteInput)[] = [
    'producer_id','assigned_to_user_id','internal_recommendation','notes','lost_reason',
  ]
  for (const f of fields) {
    if (input[f] !== undefined) { setClauses.push(`${f} = $${idx}`); values.push(input[f]); idx++ }
  }

  return queryOne<Quote>(
    `UPDATE quotes SET ${setClauses.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`,
    values
  )
}

export async function addOption(quoteId: string, input: AddQuoteOptionInput): Promise<QuoteOption> {
  const row = await queryOne<QuoteOption>(
    `INSERT INTO quote_options
       (quote_id, company_id, plan_name, coverage, premium, currency,
        payment_options, company_ranking, internal_notes,
        is_analyzed, is_sent_to_client, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      quoteId, input.company_id, input.plan_name,
      JSON.stringify(input.coverage), input.premium, input.currency,
      input.payment_options ? JSON.stringify(input.payment_options) : null,
      input.company_ranking ?? null, input.internal_notes ?? null,
      input.is_analyzed, input.is_sent_to_client, input.sort_order,
    ]
  )
  if (!row) throw new AppError('QUOTE_OPTION_INSERT_FAILED', 'Option insert returned no row', 500)
  return row
}

export async function updateOption(
  optionId: string, quoteId: string, input: UpdateQuoteOptionInput
): Promise<QuoteOption | null> {
  const setClauses: string[] = []
  const values: unknown[] = [optionId, quoteId]
  let idx = 3

  const fields: (keyof UpdateQuoteOptionInput)[] = [
    'plan_name','coverage','premium','payment_options','company_ranking',
    'internal_notes','is_analyzed','is_sent_to_client','sort_order',
  ]
  for (const f of fields) {
    if (input[f] !== undefined) {
      const val = (f === 'coverage' || f === 'payment_options') && input[f]
        ? JSON.stringify(input[f]) : input[f]
      setClauses.push(`${f} = $${idx}`)
      values.push(val); idx++
    }
  }
  if (!setClauses.length) return queryOne<QuoteOption>(`SELECT * FROM quote_options WHERE id = $1`, [optionId])

  return queryOne<QuoteOption>(
    `UPDATE quote_options SET ${setClauses.join(', ')} WHERE id = $1 AND quote_id = $2 RETURNING *`,
    values
  )
}

export async function deleteOption(optionId: string, quoteId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `DELETE FROM quote_options WHERE id = $1 AND quote_id = $2 RETURNING id`,
    [optionId, quoteId]
  )
  return row !== null
}

export async function markAsSent(
  id: string, orgId: string, input: MarkSentInput, updatedBy: string
): Promise<Quote | null> {
  return withTransaction(async (client) => {
    // Mark specified options as sent to client
    await client.query(
      `UPDATE quote_options SET is_sent_to_client = (id = ANY($1::uuid[]))
       WHERE quote_id = $2`,
      [input.option_ids, id]
    )
    // Advance quote status and store PDF url if provided
    const { rows } = await client.query<Quote>(
      `UPDATE quotes
       SET status = 'sent_to_client',
           sent_at = now(),
           commercial_pdf_url = COALESCE($3, commercial_pdf_url),
           updated_by = $4, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, input.commercial_pdf_url ?? null, updatedBy]
    )
    return rows[0] ?? null
  })
}

export async function selectOption(
  id: string, orgId: string, input: SelectOptionInput, updatedBy: string
): Promise<Quote | null> {
  return withTransaction(async (client) => {
    await client.query(
      `UPDATE quote_options SET is_selected = (id = $1) WHERE quote_id = $2`,
      [input.option_id, id]
    )
    const { rows } = await client.query<Quote>(
      `UPDATE quotes
       SET selected_option_id = $3,
           selection_reason   = $4,
           status             = 'selected',
           updated_by = $5, updated_at = now()
       WHERE id = $1 AND org_id = $2 RETURNING *`,
      [id, orgId, input.option_id, input.selection_reason ?? null, updatedBy]
    )
    return rows[0] ?? null
  })
}
