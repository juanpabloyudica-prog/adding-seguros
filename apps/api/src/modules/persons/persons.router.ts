import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { idempotencyMiddleware } from '../../middleware/idempotency.middleware.js'
import {
  createPersonSchema,
  updatePersonSchema,
  listPersonsSchema,
  personIdParamSchema,
} from './persons.schema.js'
import {
  getPersonById,
  getPersons,
  createNewPerson,
  updateExistingPerson,
  deletePersonById,
} from './persons.service.js'

export const personsRouter = Router()

// ─── GET /api/persons ─────────────────────────────────────────────────────────
// List persons with optional search, filters, and pagination.
// Requires: readonly or above
personsRouter.get(
  '/',
  requireRole('readonly'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const params = listPersonsSchema.parse(req.query)
      const result = await getPersons(req.auth.orgId, params)
      res.json(result)
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/persons/:id ─────────────────────────────────────────────────────
// Get a single person by id with producer and assigned_to joined.
// Requires: readonly or above
personsRouter.get(
  '/:id',
  requireRole('readonly'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = personIdParamSchema.parse(req.params)
      const person = await getPersonById(id, req.auth.orgId)
      res.json({ data: person })
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/persons ────────────────────────────────────────────────────────
// Create a new person.
// Requires: operativo or above
// Validates: doc uniqueness, producer/user org membership
personsRouter.post(
  '/',
  requireRole('operativo'),
  idempotencyMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createPersonSchema.parse(req.body)
      const person = await createNewPerson(
        req.auth.orgId,
        input,
        req.auth.userId
      )
      res.status(201).json({ data: person })
    } catch (err) {
      next(err)
    }
  }
)

// ─── PATCH /api/persons/:id ───────────────────────────────────────────────────
// Partial update. Only provided fields are updated.
// Requires: operativo or above
personsRouter.patch(
  '/:id',
  requireRole('operativo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = personIdParamSchema.parse(req.params)
      const input  = updatePersonSchema.parse(req.body)
      const person = await updateExistingPerson(
        id,
        req.auth.orgId,
        input,
        req.auth.userId
      )
      res.json({ data: person })
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/persons/:id ──────────────────────────────────────────────────
// Hard delete. Returns 204 with no body on success.
// Requires: admin only
// Note: will fail with FK violation if person has linked policies/cases.
// The error middleware maps 23503 to a 422 with INVALID_REFERENCE code.
personsRouter.delete(
  '/:id',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = personIdParamSchema.parse(req.params)
      await deletePersonById(id, req.auth.orgId, req.auth.userId)
      res.status(204).send()
    } catch (err) {
      next(err)
    }
  }
)
