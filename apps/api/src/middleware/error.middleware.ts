import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { isAppError } from '../shared/errors.js'
import { logger } from '../shared/logger.js'

interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Central error handler.
 * Must be registered as the LAST middleware in app.ts (after all routes).
 *
 * Handles:
 * - AppError subclasses (NotFoundError, ForbiddenError, etc.)
 * - ZodError (validation failures from schema parsing)
 * - Unknown errors (500 with sanitized message in production)
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // ─── AppError (our domain errors) ──────────────────────────────────────────
  if (isAppError(err)) {
    const body: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    }
    res.status(err.statusCode).json(body)
    return
  }

  // ─── Zod validation errors ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }))
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    } satisfies ErrorResponse)
    return
  }

  // ─── PostgreSQL unique violation ───────────────────────────────────────────
  const pgError = err as { code?: string; detail?: string }
  if (pgError?.code === '23505') {
    res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with these values already exists',
        details: process.env['NODE_ENV'] === 'development'
          ? { pg_detail: pgError.detail }
          : undefined,
      },
    } satisfies ErrorResponse)
    return
  }

  // ─── PostgreSQL foreign key violation ─────────────────────────────────────
  if (pgError?.code === '23503') {
    res.status(422).json({
      error: {
        code: 'INVALID_REFERENCE',
        message: 'Referenced record does not exist',
        details: process.env['NODE_ENV'] === 'development'
          ? { pg_detail: pgError.detail }
          : undefined,
      },
    } satisfies ErrorResponse)
    return
  }

  // ─── Unknown / unexpected errors ───────────────────────────────────────────
  const isProduction = process.env['NODE_ENV'] === 'production'

  // Always log the full error server-side with request context
  logger.error({
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    err,
  }, 'Unhandled error')

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction
        ? 'An unexpected error occurred'
        : String(err instanceof Error ? err.message : err),
    },
  } satisfies ErrorResponse)
}
