import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { queryOne, queryMany } from '../../infrastructure/db/client.js'

export const usersRouter = Router()

// ─── GET /api/me ──────────────────────────────────────────────────────────────
// Returns the authenticated user's profile including producer profile if applicable.
usersRouter.get('/me', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne<{
      id: string; org_id: string; full_name: string; email: string
      role: string; phone: string | null; avatar_url: string | null
      producer_id: string | null; signature_text: string | null
    }>(
      `SELECT u.id, u.org_id, u.full_name, u.email, u.role, u.phone, u.avatar_url,
              pr.id AS producer_id, pr.signature_text
       FROM users u
       LEFT JOIN producers pr ON pr.user_id = u.id AND pr.org_id = u.org_id AND pr.is_active = true
       WHERE u.id = $1`,
      [req.auth.userId]
    )
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } })
      return
    }
    res.json({ data: user })
  } catch (err) { next(err) }
})

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Lists users in the org — used by escalation pickers and assignment UIs.
const listUsersSchema = z.object({
  role:      z.string().optional(),
  is_active: z.enum(['true','false']).transform(v => v === 'true').optional(),
  search:    z.string().max(200).optional(),
})

usersRouter.get('/', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listUsersSchema.parse(req.query)

    const conditions: string[] = ['u.org_id = $1']
    const values: unknown[] = [req.auth.orgId]
    let idx = 2

    if (params.role) {
      conditions.push(`u.role = $${idx}`)
      values.push(params.role); idx++
    }
    if (params.is_active !== undefined) {
      conditions.push(`u.is_active = $${idx}`)
      values.push(params.is_active); idx++
    }
    if (params.search) {
      conditions.push(`(u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`)
      values.push(`%${params.search}%`); idx++
    }

    const users = await queryMany<{
      id: string; full_name: string; email: string; role: string
      avatar_url: string | null; is_active: boolean
      producer_id: string | null
    }>(
      `SELECT u.id, u.full_name, u.email, u.role, u.avatar_url, u.is_active,
              pr.id AS producer_id
       FROM users u
       LEFT JOIN producers pr ON pr.user_id = u.id AND pr.org_id = u.org_id AND pr.is_active = true
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.full_name ASC`,
      values
    )

    res.json({ data: users })
  } catch (err) { next(err) }
})

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
// Admin-only: toggle is_active, update role. Cannot modify own account via this route.
const updateUserSchema = z.object({
  is_active: z.boolean().optional(),
  role:      z.enum(['admin', 'operativo', 'productor', 'readonly'] as const).optional(),
  full_name: z.string().min(2).max(200).trim().optional(),
  phone:     z.string().max(30).nullable().optional(),
})

usersRouter.patch('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = z.string().uuid().parse(req.params['id'])
    const input  = updateUserSchema.parse(req.body)

    // Prevent modifying own account status
    if (userId === req.auth.userId && input.is_active === false) {
      res.status(400).json({ error: { code: 'SELF_DEACTIVATE', message: 'Cannot deactivate your own account' } })
      return
    }

    const setClauses: string[] = ['updated_at = now()']
    const values: unknown[]    = [userId, req.auth.orgId]
    let idx = 3

    if (input.is_active !== undefined) { setClauses.push(`is_active = $${idx}`); values.push(input.is_active); idx++ }
    if (input.role      !== undefined) { setClauses.push(`role = $${idx}`);      values.push(input.role);      idx++ }
    if (input.full_name !== undefined) { setClauses.push(`full_name = $${idx}`); values.push(input.full_name); idx++ }
    if (input.phone     !== undefined) { setClauses.push(`phone = $${idx}`);     values.push(input.phone);     idx++ }

    const updated = await queryOne<{ id: string; full_name: string; email: string; role: string; is_active: boolean }>(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $1 AND org_id = $2
       RETURNING id, full_name, email, role, is_active`,
      values
    )

    if (!updated) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found in this organization' } })
      return
    }

    res.json({ data: updated })
  } catch (err) { next(err) }
})
