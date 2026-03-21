import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { UnauthorizedError } from '../shared/errors.js'
import { createModuleLogger } from '../shared/logger.js'

const log = createModuleLogger('auth.middleware')
import { queryOne } from '../infrastructure/db/client.js'
import type { UserRole } from '@adding/types'

// ─── Supabase admin client (service role) ─────────────────────────────────────
// Used only to verify JWTs — never exposes data directly to clients.
const supabaseAdmin = createClient(
  process.env['SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ─── Row shape from DB ────────────────────────────────────────────────────────
interface UserRow {
  id: string
  org_id: string
  role: UserRole
  email: string
  is_active: boolean
}

/**
 * Verifies the Bearer JWT from Authorization header using Supabase Auth.
 * Loads the user row from our users table to get org_id and role.
 * Populates req.auth with { userId, orgId, role, email }.
 *
 * Must run before tenant.middleware and rbac.middleware.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header')
    }

    const token = authHeader.slice(7)

    // Verify the JWT with Supabase — returns the decoded user if valid
    const { data, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !data.user) {
      throw new UnauthorizedError('Invalid or expired token')
    }

    const supabaseUserId = data.user.id

    // Load our user row (has org_id, role, is_active)
    const user = await queryOne<UserRow>(
      `SELECT id, org_id, role, email, is_active
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [supabaseUserId]
    )

    if (!user) {
      log.warn({ supabaseUserId }, 'Authenticated token references unknown user')
      throw new UnauthorizedError('User not found in system')
    }

    if (!user.is_active) {
      log.warn({ userId: user.id, orgId: user.org_id }, 'Inactive user attempted login')
      throw new UnauthorizedError('User account is inactive')
    }

    // Populate the auth context — available to all subsequent middleware/handlers
    req.auth = {
      userId: user.id,
      orgId: user.org_id,
      role: user.role,
      email: user.email,
    }

    next()
  } catch (err) {
    next(err)
  }
}
