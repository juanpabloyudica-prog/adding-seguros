import type { Request, Response, NextFunction } from 'express'
import { createHash } from 'crypto'
import { createModuleLogger } from '../shared/logger.js'
import { queryOne, query } from '../infrastructure/db/client.js'

const log = createModuleLogger('idempotency.middleware')

// ─── Types ────────────────────────────────────────────────────────────────────

interface IdempotencyRow {
  id: string
  status: 'processing' | 'completed' | 'failed'
  status_code: number | null
  response_body: unknown
  request_hash: string
  expires_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashBody(body: unknown): string {
  const str = JSON.stringify(body ?? {})
  return createHash('sha256').update(str).digest('hex').slice(0, 16)
}

function buildEndpointKey(req: Request): string {
  // e.g. "POST /api/persons"
  return `${req.method} ${req.path}`
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Idempotency middleware for POST endpoints.
 *
 * Usage: apply to individual routers or specific routes.
 *   router.post('/', idempotencyMiddleware, handler)
 *
 * Flow:
 *   1. No header → pass through normally (idempotency is optional).
 *   2. Header present, key not seen → create 'processing' record, run handler,
 *      store result, return result.
 *   3. Header present, key completed → return stored result with same status code.
 *   4. Header present, key processing → return 409 (another request in flight).
 *   5. Header present, same key but different body → return 422.
 *   6. Key expired → treat as new (delete expired record, proceed normally).
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only apply to POST requests
  if (req.method !== 'POST') {
    next()
    return
  }

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined

  // No header → proceed normally, no idempotency applied
  if (!idempotencyKey) {
    next()
    return
  }

  if (!req.auth) {
    next()
    return
  }

  const { orgId, userId } = req.auth
  const endpoint     = buildEndpointKey(req)
  const requestHash  = hashBody(req.body)

  try {
    // ── Look up existing key ─────────────────────────────────────────────────
    const existing = await queryOne<IdempotencyRow>(
      `SELECT id, status, status_code, response_body, request_hash, expires_at
       FROM idempotency_keys
       WHERE org_id = $1 AND key_value = $2 AND endpoint = $3
       LIMIT 1`,
      [orgId, idempotencyKey, endpoint]
    )

    if (existing) {
      // ── Key expired → delete it and proceed as new ───────────────────────
      if (new Date(existing.expires_at) < new Date()) {
        await query(
          `DELETE FROM idempotency_keys WHERE id = $1`,
          [existing.id]
        )
        log.debug({ idempotencyKey, endpoint }, 'Expired idempotency key cleared, proceeding as new')
        // Fall through to create a new record below
      }
      // ── Key is still processing (in-flight duplicate) ────────────────────
      else if (existing.status === 'processing') {
        log.warn(
          { idempotencyKey, endpoint, orgId, requestId: req.requestId },
          'Duplicate request detected while key is still processing'
        )
        res.status(409).json({
          error: {
            code: 'IDEMPOTENCY_IN_FLIGHT',
            message: 'A request with this Idempotency-Key is already being processed. Retry after a moment.',
          },
        })
        return
      }
      // ── Body hash mismatch → same key, different payload ─────────────────
      else if (existing.request_hash !== requestHash) {
        log.warn(
          { idempotencyKey, endpoint, orgId, requestId: req.requestId },
          'Idempotency-Key reused with different request body'
        )
        res.status(422).json({
          error: {
            code: 'IDEMPOTENCY_KEY_MISMATCH',
            message: 'This Idempotency-Key was already used with a different request body. Each unique request must use a unique key.',
            details: {
              hint: 'The stored request for this key had a different payload. Generate a new Idempotency-Key for this request.',
              key: idempotencyKey,
            },
          },
        })
        return
      }
      // ── Key completed → replay stored response ───────────────────────────
      else if (existing.status === 'completed' && existing.status_code) {
        log.info(
          { idempotencyKey, endpoint, orgId, requestId: req.requestId },
          'Replaying idempotent response'
        )
        res.setHeader('Idempotency-Replayed', 'true')
        res.setHeader('Idempotency-Key', idempotencyKey)
        res.status(existing.status_code).json(existing.response_body)
        return
      }
      // ── Key failed → allow retry (don't replay the error) ────────────────
      else if (existing.status === 'failed') {
        await query(
          `DELETE FROM idempotency_keys WHERE id = $1`,
          [existing.id]
        )
        log.debug({ idempotencyKey, endpoint }, 'Previous failed attempt cleared, allowing retry')
        // Fall through to create new record
      }
    }

    // ── Create a new 'processing' record ────────────────────────────────────
    await query(
      `INSERT INTO idempotency_keys
         (org_id, user_id, key_value, endpoint, status, request_hash)
       VALUES ($1, $2, $3, $4, 'processing', $5)
       ON CONFLICT (org_id, key_value, endpoint) DO NOTHING`,
      [orgId, userId, idempotencyKey, endpoint, requestHash]
    )

    // ── Intercept the response to store it ──────────────────────────────────
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      const statusCode = res.statusCode

      // Store result asynchronously — don't block the response
      const newStatus = statusCode < 400 ? 'completed' : 'failed'

      query(
        `UPDATE idempotency_keys
         SET status       = $4,
             status_code  = $5,
             response_body = $6
         WHERE org_id = $1 AND key_value = $2 AND endpoint = $3`,
        [orgId, idempotencyKey, endpoint, newStatus, statusCode, JSON.stringify(body)]
      ).catch((err: unknown) => {
        log.error({ err, idempotencyKey, endpoint }, 'Failed to update idempotency record')
      })

      return originalJson(body)
    }

    next()
  } catch (err) {
    // Idempotency failures must not block the actual request
    log.error({ err, idempotencyKey, endpoint, requestId: req.requestId }, 'Idempotency middleware error, proceeding without idempotency')
    next()
  }
}
