import { createModuleLogger } from '../../shared/logger.js'
import { NotFoundError } from '../../shared/errors.js'
import {
  findCompanyById, listCompanies,
  createCompany, updateCompany,
} from './companies.repository.js'
import type { CompanyDetail } from './companies.repository.js'
import type { CreateCompanyInput, UpdateCompanyInput, ListCompaniesInput } from './companies.schema.js'
import type { Company } from '@adding/types'

const log = createModuleLogger('companies.service')

export async function getCompanyById(id: string, orgId: string): Promise<CompanyDetail> {
  const company = await findCompanyById(id, orgId)
  if (!company) throw new NotFoundError('Company', id)
  return company
}

export async function getCompanies(orgId: string, params: ListCompaniesInput) {
  return listCompanies(orgId, params)
}

export async function createNewCompany(
  orgId: string,
  input: CreateCompanyInput,
  createdBy: string
): Promise<Company> {
  const company = await createCompany(orgId, input, createdBy)
  log.info({ companyId: company.id, orgId, name: company.name }, 'Company created')
  return company
}

export async function updateExistingCompany(
  id: string,
  orgId: string,
  input: UpdateCompanyInput,
  updatedBy: string
): Promise<Company> {
  const existing = await findCompanyById(id, orgId)
  if (!existing) throw new NotFoundError('Company', id)

  const updated = await updateCompany(id, orgId, input, updatedBy)
  if (!updated) throw new NotFoundError('Company', id)

  log.info({ companyId: id, orgId }, 'Company updated')
  return updated
}
