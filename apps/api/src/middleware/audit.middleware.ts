import type { Request, Response, NextFunction } from 'express'
import { query } from '../infrastructure/db/client.js'
import { createModuleLogger } from '../shared/logger.js'

const log = createModuleLogger('audit.middleware')

// ─── HTTP methods that mutate state ──────────────────────────────────────────
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// ─── Maps HTTP method + status to an audit action verb ───────────────────────
function resolveAction(method: string, statusCode: number): string | null {
  if (statusCode >= 400) return null // Don't log failed requests as audit events
  switch (method) {
    case 'POST':   return 'created'
    case 'PUT':
    case 'PATCH':  return 'updated'
    case 'DELETE': return 'deleted'
    default:       return null
  }
}

// ─── Extracts entity type and id from the URL path ───────────────────────────
// e.g. /persons/abc-123        → { entityType: 'persons', entityId: 'abc-123' }
// e.g. /persons/abc-123/risks  → { entityType: 'persons', entityId: 'abc-123' }
// e.g. /persons (POST)         → entityId will be taken from response body
function parseEntityFromPath(path: string): { entityType: string; entityId: string | null } {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean)
  const entityType = segments[0] ?? 'unknown'
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const entityId = segments[1] && uuidPattern.test(segments[1]) ? segments[1] : null
  return { entityType, entityId }
}

/**
 * Audit trail middleware.
 *
 * Intercepts the response after it's sent to write an entry into the
 * `events` table for every successful mutating request (POST, PUT, PATCH, DELETE).
 *
 * Does not block the response — the audit write happens asynchronously
 * after the response is already sent to the client.
 *
 * For creates (POST 201), the entityId is extracted from the response body
 * since it doesn't exist in the URL yet.
 */
export function auditMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!MUTATING_METHODS.has(req.method)) {
    next()
    return
  }

  // Capture response body for POST (to get the new entity's id)
  const originalJson = res.json.bind(res)
  let responseBody: unknown = null

  res.json = function (body: unknown) {
    responseBody = body
    return originalJson(body)
  }

  res.on('finish', () => {
    const action = resolveAction(req.method, res.statusCode)
    if (!action || !req.auth) return

    const { entityType, entityId: pathEntityId } = parseEntityFromPath(req.path)

    // For POSTs, try to get the id from the response body
    let entityId = pathEntityId
    if (!entityId && req.method === 'POST' && responseBody) {
      const body = responseBody as Record<string, unknown>
      entityId = (body['data'] as Record<string, unknown>)?.['id'] as string
                 ?? body['id'] as string
                 ?? null
    }

    if (!entityId) return // Can't audit without an entity id

    const payload: Record<string, unknown> = {}
    // For updates/creates, include sanitized body (strip sensitive fields)
    if (req.method !== 'DELETE') {
      const body = { ...(req.body as Record<string, unknown>) }
      // Never log these fields
      delete body['password']
      delete body['token']
      delete body['secret']
      payload['input'] = body
    }

    // Fire and forget — audit failures must never affect the response
    query(
      `INSERT INTO events
         (org_id, user_id, entity_type, entity_id, action, payload, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.auth.orgId,
        req.auth.userId,
        entityType,
        entityId,
        action,
        JSON.stringify(payload),
        req.ip ?? null,
        req.get('user-agent') ?? null,
      ]
    ).catch((err: unknown) => {
      log.error({ err, entityType, entityId, action }, 'Failed to write audit event')
    })
  })

  next()
}
