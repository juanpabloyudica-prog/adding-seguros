import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

// Extend Express Request with requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string
    }
  }
}

/**
 * Generates a unique requestId per request.
 * Respects X-Request-Id header if sent by upstream (e.g. a load balancer).
 * Attaches it to req.requestId and echoes it in the response header.
 *
 * This id flows through all logger calls so every log line for a single
 * request can be correlated in production log aggregators.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID()
  req.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}
