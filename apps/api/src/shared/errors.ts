// ─── Domain errors ────────────────────────────────────────────────────────────
// All errors extend AppError so the error middleware can handle them uniformly.

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    )
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
    this.name = 'ForbiddenError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 422, details)
    this.name = 'ValidationError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409)
    this.name = 'ConflictError'
  }
}

// ─── Type guard ───────────────────────────────────────────────────────────────
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

// ─── PostgreSQL error code helpers ───────────────────────────────────────────
export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505'
}

export function isForeignKeyViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23503'
}
