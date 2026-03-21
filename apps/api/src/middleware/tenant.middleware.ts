import type { Request, Response, NextFunction } from 'express'
import { ForbiddenError } from '../shared/errors.js'

/**
 * Tenant guard middleware.
 *
 * req.auth.orgId is set by authMiddleware from our DB row — it is the
 * source of truth for multi-tenancy. This middleware ensures:
 *
 * 1. req.auth is present (authMiddleware ran first).
 * 2. If the request body contains an `org_id` field, it matches the
 *    authenticated user's org. This prevents a client from submitting
 *    data into a different organization's namespace.
 *
 * All repository queries use req.auth.orgId directly — they never trust
 * any org_id from the request body or params.
 */
export function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    next(new ForbiddenError('Not authenticated'))
    return
  }

  // If body includes org_id, it must match the authenticated user's org.
  // This is a safety net — routes should strip org_id from body before
  // reaching services, but we enforce it here as defense in depth.
  const bodyOrgId = (req.body as Record<string, unknown>)?.['org_id']
  if (bodyOrgId && bodyOrgId !== req.auth.orgId) {
    next(
      new ForbiddenError(
        'org_id in request body does not match authenticated organization'
      )
    )
    return
  }

  next()
}
