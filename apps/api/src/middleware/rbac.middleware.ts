import type { Request, Response, NextFunction } from 'express'
import { ForbiddenError } from '../shared/errors.js'
import type { UserRole } from '@adding/types'

// ─── Role hierarchy ────────────────────────────────────────────────────────────
// Higher index = more permissions. A role grants access to everything
// at its level and below.
const ROLE_HIERARCHY: Record<UserRole, number> = {
  readonly:   0,
  productor:  1,
  operativo:  2,
  supervisor: 3,
  admin:      4,
}

/**
 * Returns true if the user's role meets or exceeds the required role.
 */
export function hasRole(userRole: UserRole, required: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[required] ?? 999)
}

/**
 * Middleware factory: requires the user to have at least `minimumRole`.
 *
 * Usage:
 *   router.post('/', requireRole('operativo'), handler)
 *   router.delete('/:id', requireRole('admin'), handler)
 */
export function requireRole(minimumRole: UserRole) {
  return function rbacMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      next(new ForbiddenError('Not authenticated'))
      return
    }

    if (!hasRole(req.auth.role, minimumRole)) {
      next(
        new ForbiddenError(
          `Role '${req.auth.role}' is not allowed to perform this action. Required: '${minimumRole}' or higher.`
        )
      )
      return
    }

    next()
  }
}

/**
 * Middleware factory: requires one of the listed roles exactly.
 * Use when access is role-specific, not hierarchical.
 *
 * Usage:
 *   router.get('/', requireAnyRole(['admin', 'supervisor']), handler)
 */
export function requireAnyRole(roles: UserRole[]) {
  return function rbacAnyMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    if (!req.auth) {
      next(new ForbiddenError('Not authenticated'))
      return
    }

    if (!roles.includes(req.auth.role)) {
      next(
        new ForbiddenError(
          `Role '${req.auth.role}' is not allowed. Allowed roles: ${roles.join(', ')}.`
        )
      )
      return
    }

    next()
  }
}
