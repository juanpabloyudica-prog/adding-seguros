import { createModuleLogger } from '../../shared/logger.js'
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors.js'
import { queryOne } from '../../infrastructure/db/client.js'
import {
  findQuoteById, listQuotes, createQuote, updateQuote,
  addOption, updateOption, deleteOption, markAsSent, selectOption,
} from './quotes.repository.js'
import type { QuoteDetail } from './quotes.repository.js'
import type {
  CreateQuoteInput, UpdateQuoteInput, AddQuoteOptionInput,
  UpdateQuoteOptionInput, SelectOptionInput, MarkSentInput, ListQuotesInput,
} from './quotes.schema.js'
import type { Quote, QuoteOption } from '@adding/types'

const log = createModuleLogger('quotes.service')

async function assertPersonExists(personId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM persons WHERE id=$1 AND org_id=$2 AND deleted_at IS NULL LIMIT 1`,
    [personId, orgId]
  )
  if (!row) throw new ValidationError(`Person '${personId}' not found`)
}

async function assertRiskExists(riskId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM risks WHERE id=$1 AND org_id=$2 LIMIT 1`,
    [riskId, orgId]
  )
  if (!row) throw new ValidationError(`Risk '${riskId}' not found`)
}

async function assertCompanyExists(companyId: string, orgId: string) {
  const row = await queryOne<{id:string}>(
    `SELECT id FROM companies WHERE id=$1 AND org_id=$2 AND is_active=true LIMIT 1`,
    [companyId, orgId]
  )
  if (!row) throw new ValidationError(`Company '${companyId}' not found or inactive`)
}

export async function getQuoteById(id: string, orgId: string): Promise<QuoteDetail> {
  const q = await findQuoteById(id, orgId)
  if (!q) throw new NotFoundError('Quote', id)
  return q
}

export async function getQuotes(orgId: string, params: ListQuotesInput) {
  return listQuotes(orgId, params)
}

export async function createNewQuote(
  orgId: string, input: CreateQuoteInput, createdBy: string
): Promise<Quote> {
  await assertPersonExists(input.person_id, orgId)
  await assertRiskExists(input.risk_id, orgId)
  const q = await createQuote(orgId, input, createdBy)
  log.info({ quoteId: q.id, personId: input.person_id, orgId }, 'Quote created')
  return q
}

export async function updateExistingQuote(
  id: string, orgId: string, input: UpdateQuoteInput, updatedBy: string
): Promise<Quote> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)
  if (existing.status === 'emitted') throw new ValidationError('Cannot update an emitted quote')

  const updated = await updateQuote(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Quote', id)
  return updated
}

export async function addQuoteOption(
  id: string, orgId: string, input: AddQuoteOptionInput
): Promise<QuoteOption> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)
  await assertCompanyExists(input.company_id, orgId)

  const option = await addOption(id, input)

  // If this is the first option, advance status from draft
  if (existing.status === 'draft') {
    await updateQuote(id, orgId, {}, existing.created_by)
    await queryOne(
      `UPDATE quotes SET status = 'options_loaded', updated_at = now() WHERE id = $1`, [id]
    )
  }

  log.info({ quoteId: id, optionId: option.id, companyId: input.company_id }, 'Quote option added')
  return option
}

export async function updateQuoteOption(
  id: string, orgId: string, optionId: string, input: UpdateQuoteOptionInput
): Promise<QuoteOption> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)

  const option = existing.options.find(o => o.id === optionId)
  if (!option) throw new NotFoundError('QuoteOption', optionId)

  const updated = await updateOption(optionId, id, input)
  if (!updated) throw new NotFoundError('QuoteOption', optionId)
  return updated
}

export async function removeQuoteOption(id: string, orgId: string, optionId: string): Promise<void> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)
  if (existing.selected_option_id === optionId) {
    throw new ConflictError('Cannot delete the selected option. Deselect it first.')
  }
  await deleteOption(optionId, id)
}

export async function markQuoteAsSent(
  id: string, orgId: string, input: MarkSentInput, updatedBy: string
): Promise<Quote> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)
  if (!['options_loaded','draft','sent_to_client'].includes(existing.status)) {
    throw new ValidationError(`Cannot mark a ${existing.status} quote as sent`)
  }
  const updated = await markAsSent(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Quote', id)
  log.info({ quoteId: id, optionCount: input.option_ids.length, orgId }, 'Quote marked as sent')
  return updated
}

export async function selectQuoteOption(
  id: string, orgId: string, input: SelectOptionInput, updatedBy: string
): Promise<Quote> {
  const existing = await findQuoteById(id, orgId)
  if (!existing) throw new NotFoundError('Quote', id)
  if (!['sent_to_client','options_loaded'].includes(existing.status)) {
    throw new ValidationError(`Cannot select option on a ${existing.status} quote`)
  }
  const optionExists = existing.options.find(o => o.id === input.option_id)
  if (!optionExists) throw new ValidationError(`Option '${input.option_id}' not found in this quote`)

  const updated = await selectOption(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Quote', id)
  log.info({ quoteId: id, optionId: input.option_id, orgId }, 'Quote option selected')
  return updated
}
