import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  createRiskSchema, updateRiskSchema,
  listRisksSchema, riskIdParamSchema, riskByPersonSchema,
} from './risks.schema.js'
import {
  getRiskById, getRisks, getRisksForPerson,
  createNewRisk, updateExistingRisk,
} from './risks.service.js'

export const risksRouter = Router()

// GET /api/risks  (global list, filterable by person_id and type)
risksRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getRisks(req.auth.orgId, listRisksSchema.parse(req.query)))
  } catch (err) { next(err) }
})

// GET /api/risks/:id
risksRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = riskIdParamSchema.parse(req.params)
    res.json({ data: await getRiskById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// GET /api/risks/by-person/:personId  — convenience for person detail view
risksRouter.get('/by-person/:personId', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { personId } = riskByPersonSchema.parse(req.params)
    res.json({ data: await getRisksForPerson(personId, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/risks
risksRouter.post('/', requireRole('operativo'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createRiskSchema.parse(req.body)
    res.status(201).json({ data: await createNewRisk(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/risks/:id  — merges data fields, does not replace
risksRouter.patch('/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = riskIdParamSchema.parse(req.params)
    const input  = updateRiskSchema.parse(req.body)
    res.json({ data: await updateExistingRisk(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})
