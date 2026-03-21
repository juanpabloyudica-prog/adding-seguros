import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  createPolicySchema, updatePolicySchema, updatePolicyStatusSchema,
  renewPolicySchema, updateRenewalStatusSchema,
  listPoliciesSchema, expiringPoliciesSchema, policyIdParamSchema,
  dashboardSummarySchema,
} from './policies.schema.js'
import {
  getPolicyById, getPolicies, getExpiringForAlerts,
  createNewPolicy, updateExistingPolicy, transitionPolicyStatus,
  renewExistingPolicy, setRenewalStatus,
  getPoliciesDashboardSummary,
} from './policies.service.js'

export const policiesRouter = Router()

// GET /api/policies
policiesRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await getPolicies(req.auth.orgId, listPoliciesSchema.parse(req.query))) }
  catch (err) { next(err) }
})

// GET /api/policies/dashboard-summary  ← before /:id to avoid param conflict
policiesRouter.get('/dashboard-summary', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = dashboardSummarySchema.parse(req.query)
    const summary = await getPoliciesDashboardSummary(req.auth.orgId, params)
    res.json({ data: summary })
  } catch (err) { next(err) }
})

// GET /api/policies/expiring  ← must be before /:id to avoid param conflict
policiesRouter.get('/expiring', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = expiringPoliciesSchema.parse(req.query)
    const data = await getExpiringForAlerts(req.auth.orgId, params)
    res.json({ data, meta: { days: params.days, count: data.length } })
  } catch (err) { next(err) }
})

// GET /api/policies/:id
policiesRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = policyIdParamSchema.parse(req.params)
    res.json({ data: await getPolicyById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/policies
policiesRouter.post('/', requireRole('operativo'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPolicySchema.parse(req.body)
    res.status(201).json({ data: await createNewPolicy(req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/policies/:id  — field updates
policiesRouter.patch('/:id', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = policyIdParamSchema.parse(req.params)
    res.json({ data: await updateExistingPolicy(id, req.auth.orgId, updatePolicySchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/policies/:id/status  — explicit status transition with lifecycle validation
policiesRouter.patch('/:id/status', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = policyIdParamSchema.parse(req.params)
    res.json({ data: await transitionPolicyStatus(id, req.auth.orgId, updatePolicyStatusSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// POST /api/policies/:id/renew  — creates a new policy, marks the old one expired
policiesRouter.post('/:id/renew', requireRole('operativo'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = policyIdParamSchema.parse(req.params)
    res.status(201).json({ data: await renewExistingPolicy(id, req.auth.orgId, renewPolicySchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})

// PATCH /api/policies/:id/renewal-status  — update commercial renewal tracking
policiesRouter.patch('/:id/renewal-status', requireRole('operativo'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = policyIdParamSchema.parse(req.params)
    res.json({ data: await setRenewalStatus(id, req.auth.orgId, updateRenewalStatusSchema.parse(req.body), req.auth.userId) })
  } catch (err) { next(err) }
})
