import type { Request } from 'express'
import type { UserRole } from '@adding/types'

// ─── Authenticated request context ───────────────────────────────────────────
// Injected by auth.middleware + tenant.middleware on every authenticated request

export interface AuthContext {
  userId: string
  orgId: string
  role: UserRole
  email: string
}

// Extend Express Request with our context
declare global {
  namespace Express {
    interface Request {
      auth: AuthContext
    }
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page: number
  limit: number
  offset: number
}

export function parsePagination(
  query: Record<string, unknown>,
  maxLimit = 100
): PaginationQuery {
  const page = Math.max(1, parseInt(String(query['page'] ?? '1'), 10))
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(query['limit'] ?? '20'), 10)))
  return { page, limit, offset: (page - 1) * limit }
}
