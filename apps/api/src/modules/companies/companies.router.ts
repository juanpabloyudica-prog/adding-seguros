import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  createCompanySchema, updateCompanySchema,
  listCompaniesSchema, companyIdParamSchema,
} from './companies.schema.js'
import {
  getCompanyById, getCompanies,
  createNewCompany, updateExistingCompany,
} from './companies.service.js'

export const companiesRouter = Router()

// GET /api/companies
companiesRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getCompanies(req.auth.orgId, listCompaniesSchema.parse(req.query)))
  } catch (err) { next(err) }
})

// GET /api/companies/:id
companiesRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = companyIdParamSchema.parse(req.params)
    res.json({ data: await getCompanyById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/companies
companiesRouter.post('/', requireRole('admin'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createCompanySchema.parse(req.body)
    res.status(201).json({ data: await createNewCompany(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/companies/:id
companiesRouter.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = companyIdParamSchema.parse(req.params)
    const input  = updateCompanySchema.parse(req.body)
    res.json({ data: await updateExistingCompany(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})
// Companies are deactivated via PATCH { is_active: false }, never deleted.
