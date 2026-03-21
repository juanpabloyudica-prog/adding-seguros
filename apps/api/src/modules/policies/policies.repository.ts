import { queryOne, queryMany, withTransaction } from '../../infrastructure/db/client.js'
import { buildPaginatedResponse, daysUntil } from '@adding/utils'
import type { Policy } from '@adding/types'
import type {
  CreatePolicyInput, UpdatePolicyInput,
  UpdatePolicyStatusInput, RenewPolicyInput,
  ListPoliciesInput, ExpiringPoliciesInput,
  DashboardSummaryInput, PolicyDashboardSummary,
} from './policies.schema.js'

export interface PolicyDetail extends Policy {
  person:             { id: string; full_name: string; phone: string | null } | null
  company:            { id: string; name: string; short_name: string | null; logo_url: string | null } | null
  producer:           { id: string; full_name: string } | null
  risk:               { id: string; type: string; data: Record<string, unknown> } | null
  computed_status:    'draft' | 'active' | 'expiring' | 'expired' | 'cancelled'
  days_until_expiry:  number
}

function computeStatus(
  storedStatus: string,
  endDate: string,
  renewalAlertDays: number
): PolicyDetail['computed_status'] {
  if (storedStatus !== 'active') return storedStatus as PolicyDetail['computed_status']
  const days = daysUntil(endDate)
  if (days <= renewalAlertDays && days >= 0) return 'expiring'
  return 'active'
}

const POLICY_SELECT = `
  pol.*,
  json_build_object('id', pe.id, 'full_name', pe.full_name, 'phone', pe.phone) AS person,
  json_build_object('id', co.id, 'name', co.name, 'short_name', co.short_name, 'logo_url', co.logo_url) AS company,
  CASE WHEN pr.id IS NOT NULL THEN json_build_object('id', pr.id, 'full_name', pu.full_name) END AS producer,
  CASE WHEN ri.id IS NOT NULL THEN json_build_object('id', ri.id, 'type', ri.type, 'data', ri.data) END AS risk,
  (pol.end_date - CURRENT_DATE)::int AS days_until_expiry
`

const POLICY_JOINS = `
  JOIN persons   pe ON pe.id  = pol.person_id
  JOIN companies co ON co.id  = pol.company_id
  LEFT JOIN producers pr ON pr.id  = pol.producer_id
  LEFT JOIN users pu     ON pu.id  = pr.user_id
  LEFT JOIN risks    ri ON ri.id  = pol.risk_id
`

export async function findPolicyById(id: string, orgId: string): Promise<PolicyDetail | null> {
  const row = await queryOne<Policy & { end_date: string; renewal_alert_days: number }>(
    `SELECT ${POLICY_SELECT} FROM policies pol ${POLICY_JOINS} WHERE pol.id = $1 AND pol.org_id = $2 LIMIT 1`,
    [id, orgId]
  )
  if (!row) return null
  return {
    ...(row as unknown as PolicyDetail),
    computed_status:   computeStatus(row.status, row.end_date, row.renewal_alert_days),
    days_until_expiry: daysUntil(row.end_date),
  }
}

export async function listPolicies(orgId: string, params: ListPoliciesInput) {
  const { page, limit, person_id, company_id, producer_id, assigned_to_user_id, status, ramo } = params
  const offset = (page - 1) * limit
  const conditions: string[] = ['pol.org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2
  if (person_id)           { conditions.push(`pol.person_id = $${idx}`);           values.push(person_id);           idx++ }
  if (company_id)          { conditions.push(`pol.company_id = $${idx}`);          values.push(company_id);          idx++ }
  if (producer_id)         { conditions.push(`pol.producer_id = $${idx}`);         values.push(producer_id);         idx++ }
  if (assigned_to_user_id) { conditions.push(`pol.assigned_to_user_id = $${idx}`); values.push(assigned_to_user_id); idx++ }
  if (status)              { conditions.push(`pol.status = $${idx}`);              values.push(status);              idx++ }
  if (ramo)                { conditions.push(`pol.ramo ILIKE $${idx}`);            values.push(`%${ramo}%`);         idx++ }
  const whereClause = conditions.join(' AND ')
  const countResult = await queryOne<{ count: string }>(`SELECT COUNT(*) AS count FROM policies pol WHERE ${whereClause}`, values)
  const total = parseInt(countResult?.count ?? '0', 10)
  const rows = await queryMany<Policy & { end_date: string; renewal_alert_days: number }>(
    `SELECT ${POLICY_SELECT} FROM policies pol ${POLICY_JOINS} WHERE ${whereClause} ORDER BY pol.end_date ASC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset]
  )
  const data = rows.map((row) => ({
    ...(row as unknown as PolicyDetail),
    computed_status:   computeStatus(row.status, row.end_date, row.renewal_alert_days),
    days_until_expiry: daysUntil(row.end_date),
  }))
  return buildPaginatedResponse(data, total, page, limit)
}

export async function getExpiringPolicies(orgId: string, params: ExpiringPoliciesInput): Promise<PolicyDetail[]> {
  const { days, producer_id } = params
  const conditions = ['pol.org_id = $1', 'pol.status = $2', "pol.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($3 || ' days')::interval"]
  const values: unknown[] = [orgId, 'active', days]
  let idx = 4
  if (producer_id) { conditions.push(`pol.producer_id = $${idx}`); values.push(producer_id) }
  const rows = await queryMany<Policy & { end_date: string; renewal_alert_days: number }>(
    `SELECT ${POLICY_SELECT} FROM policies pol ${POLICY_JOINS} WHERE ${conditions.join(' AND ')} ORDER BY pol.end_date ASC`,
    values
  )
  return rows.map((row) => ({ ...(row as unknown as PolicyDetail), computed_status: 'expiring' as const, days_until_expiry: daysUntil(row.end_date) }))
}

export async function createPolicy(orgId: string, input: CreatePolicyInput, createdBy: string, renewedFromId?: string): Promise<Policy> {
  const row = await queryOne<Policy>(
    `INSERT INTO policies (org_id,person_id,company_id,producer_id,assigned_to_user_id,risk_id,quote_id,quote_option_id,renewed_from_id,policy_number,endorsement_number,ramo,plan,start_date,end_date,premium,sum_insured,currency,payment_frequency,renewal_alert_days,auto_renew,coverage_summary,external_policy_number,external_company_id,notes,status,created_by,updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'active',$26,$26) RETURNING *`,
    [orgId,input.person_id,input.company_id,input.producer_id??null,input.assigned_to_user_id??null,input.risk_id??null,input.quote_id??null,input.quote_option_id??null,renewedFromId??null,input.policy_number,input.endorsement_number??null,input.ramo,input.plan??null,input.start_date,input.end_date,input.premium??null,input.sum_insured??null,input.currency,input.payment_frequency??null,input.renewal_alert_days,input.auto_renew,input.coverage_summary!=null?JSON.stringify(input.coverage_summary):null,input.external_policy_number??null,input.external_company_id??null,input.notes??null,createdBy]
  )
  if (!row) throw new Error('Insert returned no row')
  return row
}

export async function renewPolicy(oldPolicyId: string, orgId: string, oldPolicy: Policy, input: RenewPolicyInput, createdBy: string): Promise<Policy> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<Policy>(
      `INSERT INTO policies (org_id,person_id,company_id,producer_id,assigned_to_user_id,risk_id,quote_id,quote_option_id,renewed_from_id,policy_number,ramo,plan,start_date,end_date,premium,sum_insured,currency,payment_frequency,renewal_alert_days,auto_renew,notes,status,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'active',$22,$22) RETURNING *`,
      [orgId,oldPolicy.person_id,oldPolicy.company_id,oldPolicy.producer_id??null,oldPolicy.assigned_to_user_id??null,oldPolicy.risk_id??null,input.quote_id??oldPolicy.quote_id??null,input.quote_option_id??oldPolicy.quote_option_id??null,oldPolicyId,input.policy_number,oldPolicy.ramo,oldPolicy.plan??null,input.start_date,input.end_date,input.premium??oldPolicy.premium??null,input.sum_insured??oldPolicy.sum_insured??null,oldPolicy.currency,input.payment_frequency??oldPolicy.payment_frequency??null,oldPolicy.renewal_alert_days,oldPolicy.auto_renew,input.notes??null,createdBy]
    )
    const newPolicy = rows[0]
    if (!newPolicy) throw new Error('Renewal insert returned no row')
    await client.query(`UPDATE policies SET renewal_status='renewed',status='expired',updated_by=$2,updated_at=now() WHERE id=$1`, [oldPolicyId, createdBy])
    return newPolicy
  })
}

export async function updatePolicy(id: string, orgId: string, input: UpdatePolicyInput, updatedBy: string): Promise<Policy | null> {
  const setClauses: string[] = ['updated_by = $3', 'updated_at = now()']
  const values: unknown[] = [id, orgId, updatedBy]
  let idx = 4
  const fields: (keyof UpdatePolicyInput)[] = ['producer_id','assigned_to_user_id','policy_number','endorsement_number','ramo','plan','start_date','end_date','premium','sum_insured','currency','payment_frequency','renewal_alert_days','auto_renew','coverage_summary','external_policy_number','external_company_id','notes']
  for (const field of fields) {
    if (input[field] !== undefined) { setClauses.push(`${field} = $${idx}`); values.push(input[field]); idx++ }
  }
  return queryOne<Policy>(`UPDATE policies SET ${setClauses.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`, values)
}

export async function updatePolicyStatus(id: string, orgId: string, input: UpdatePolicyStatusInput, updatedBy: string): Promise<Policy | null> {
  return queryOne<Policy>(
    `UPDATE policies SET status=$3,cancellation_date=$4,updated_by=$5,updated_at=now() WHERE id=$1 AND org_id=$2 RETURNING *`,
    [id, orgId, input.status, input.cancellation_date ?? null, updatedBy]
  )
}

export async function updateRenewalStatus(id: string, orgId: string, renewalStatus: string, updatedBy: string): Promise<Policy | null> {
  return queryOne<Policy>(
    `UPDATE policies SET renewal_status=$3,updated_by=$4,updated_at=now() WHERE id=$1 AND org_id=$2 RETURNING *`,
    [id, orgId, renewalStatus, updatedBy]
  )
}

// ─── getDashboardSummary ──────────────────────────────────────────────────────
// Single-query dashboard counters. All counts are computed server-side with
// CTEs so the frontend never needs to aggregate.
export async function getDashboardSummary(
  orgId: string,
  params: DashboardSummaryInput
): Promise<PolicyDashboardSummary> {
  const conditions: string[] = ['org_id = $1']
  const values: unknown[] = [orgId]
  let idx = 2

  if (params.producer_id) {
    conditions.push(`producer_id = $${idx}`)
    values.push(params.producer_id)
    idx++
  }

  const baseFilter = conditions.join(' AND ')

  const row = await queryOne<PolicyDashboardSummary>(
    `WITH base AS (
       SELECT status, renewal_status, end_date
       FROM policies
       WHERE ${baseFilter}
     )
     SELECT
       COUNT(*) FILTER (WHERE status = 'active')
         AS total_active,
       COUNT(*) FILTER (
         WHERE status = 'active'
           AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
       ) AS total_expiring_30,
       COUNT(*) FILTER (
         WHERE status = 'active'
           AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
       ) AS total_expiring_15,
       COUNT(*) FILTER (
         WHERE status = 'active'
           AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       ) AS total_expiring_7,
       COUNT(*) FILTER (WHERE status = 'expired')
         AS total_expired,
       COUNT(*) FILTER (WHERE status = 'cancelled')
         AS total_cancelled,
       COUNT(*) FILTER (WHERE renewal_status = 'renewed')
         AS total_renewed
     FROM base`,
    values
  )

  // queryOne returns null if no rows — but COUNT always returns a row, so
  // the null case only happens if something went wrong. Default to zeros.
  return {
    total_active:      Number(row?.total_active      ?? 0),
    total_expiring_30: Number(row?.total_expiring_30 ?? 0),
    total_expiring_15: Number(row?.total_expiring_15 ?? 0),
    total_expiring_7:  Number(row?.total_expiring_7  ?? 0),
    total_expired:     Number(row?.total_expired     ?? 0),
    total_cancelled:   Number(row?.total_cancelled   ?? 0),
    total_renewed:     Number(row?.total_renewed     ?? 0),
  }
}
