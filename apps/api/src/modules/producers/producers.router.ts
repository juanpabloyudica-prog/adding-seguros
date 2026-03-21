import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  createProducerSchema, updateProducerSchema,
  listProducersSchema, producerIdParamSchema,
} from './producers.schema.js'
import {
  getProducerById, getProducers,
  createNewProducer, updateExistingProducer,
} from './producers.service.js'

export const producersRouter = Router()

// GET /api/producers
producersRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listProducersSchema.parse(req.query)
    res.json(await getProducers(req.auth.orgId, params))
  } catch (err) { next(err) }
})

// GET /api/producers/:id
producersRouter.get('/:id', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = producerIdParamSchema.parse(req.params)
    res.json({ data: await getProducerById(id, req.auth.orgId) })
  } catch (err) { next(err) }
})

// POST /api/producers
producersRouter.post('/', requireRole('admin'), idempotencyMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createProducerSchema.parse(req.body)
    const producer = await createNewProducer(req.auth.orgId, input, req.auth.userId)
    res.status(201).json({ data: producer })
  } catch (err) { next(err) }
})

// PATCH /api/producers/:id
producersRouter.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = producerIdParamSchema.parse(req.params)
    const input  = updateProducerSchema.parse(req.body)
    res.json({ data: await updateExistingProducer(id, req.auth.orgId, input, req.auth.userId) })
  } catch (err) { next(err) }
})
// Producers are never deleted — they are deactivated via PATCH { is_active: false }
