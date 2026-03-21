import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { requireRole } from '../../middleware/rbac.middleware.js'
import { queryMany, queryOne } from '../../infrastructure/db/client.js'

export const dashboardRouter = Router()

/**
 * GET /api/dashboard/my-day
 *
 * Returns all sections needed for the /mi-dia operational view in a single
 * round-trip. Each section is independent — a failure in one does not block
 * the others (Promise.allSettled).
 *
 * Query params:
 *   assigned_to_me=true  → filters cases/conversations to current user only
 */
dashboardRouter.get('/my-day', requireRole('readonly'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, userId } = req.auth
    const assignedToMe = req.query['assigned_to_me'] === 'true'

    // Run all sections in parallel; partial failures return empty arrays
    const [
      unreadConvs,
      overdueCases,
      expiringPolicies,
      scheduledToday,
      pendingQuotes,
      failedMessages,
    ] = await Promise.allSettled([

      // ── Unread conversations ────────────────────────────────────────────────
      queryMany<{
        id: string; wa_phone: string; wa_contact_name: string | null
        unread_count: number; status: string; last_message_at: string | null
        last_message_text: string | null; person_name: string | null
        assigned_to_name: string | null
      }>(
        `SELECT c.id, c.wa_phone, c.wa_contact_name, c.unread_count,
                c.status, c.last_message_at, c.last_message_text,
                p.full_name AS person_name,
                u.full_name AS assigned_to_name
         FROM conversations c
         LEFT JOIN persons p ON p.id = c.person_id
         LEFT JOIN users   u ON u.id = c.assigned_to_user_id
         WHERE c.org_id = $1
           AND c.unread_count > 0
           AND c.status NOT IN ('closed')
           ${assignedToMe ? 'AND c.assigned_to_user_id = $2' : ''}
         ORDER BY c.last_message_at DESC NULLS LAST
         LIMIT 20`,
        assignedToMe ? [orgId, userId] : [orgId]
      ),

      // ── Overdue cases ───────────────────────────────────────────────────────
      queryMany<{
        id: string; title: string; type: string; priority: string; status: string
        due_date: string; days_overdue: number
        person_name: string | null; assigned_to_name: string | null
      }>(
        `SELECT c.id, c.title, c.type, c.priority, c.status,
                c.due_date::text,
                (CURRENT_DATE - c.due_date::date) AS days_overdue,
                p.full_name AS person_name,
                u.full_name AS assigned_to_name
         FROM cases c
         LEFT JOIN persons p ON p.id = c.person_id
         LEFT JOIN users   u ON u.id = c.assigned_to_user_id
         WHERE c.org_id = $1
           AND c.due_date < CURRENT_DATE
           AND c.status NOT IN ('closed', 'cancelled')
           ${assignedToMe ? 'AND c.assigned_to_user_id = $2' : ''}
         ORDER BY c.due_date ASC
         LIMIT 20`,
        assignedToMe ? [orgId, userId] : [orgId]
      ),

      // ── Policies expiring in ≤15 days ───────────────────────────────────────
      queryMany<{
        id: string; ramo: string; end_date: string; days_until_expiry: number
        person_name: string | null; person_phone: string | null
        company_name: string | null; producer_name: string | null
        renewal_status: string | null
      }>(
        `SELECT pol.id, pol.ramo, pol.end_date::text,
                (pol.end_date::date - CURRENT_DATE) AS days_until_expiry,
                pe.full_name AS person_name, pe.phone AS person_phone,
                co.name AS company_name, pu.full_name AS producer_name,
                pol.renewal_status
         FROM policies pol
         JOIN persons pe ON pe.id = pol.person_id
         JOIN companies co ON co.id = pol.company_id
         LEFT JOIN producers pr ON pr.id = pol.producer_id
         LEFT JOIN users pu ON pu.id = pr.user_id
         WHERE pol.org_id = $1
           AND pol.status = 'active'
           AND pol.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days'
           ${assignedToMe ? 'AND pol.producer_id IN (SELECT id FROM producers WHERE user_id = $2)' : ''}
         ORDER BY pol.end_date ASC
         LIMIT 20`,
        assignedToMe ? [orgId, userId] : [orgId]
      ),

      // ── Messages scheduled for today ────────────────────────────────────────
      queryMany<{
        id: string; scheduled_for: string; status: string
        wa_phone: string | null; template_name: string | null
        rule_name: string | null; case_id: string | null; policy_id: string | null
      }>(
        `SELECT sm.id, sm.scheduled_for::text, sm.status,
                cv.wa_phone,
                mt.name AS template_name,
                ar.name AS rule_name,
                sm.case_id, sm.policy_id
         FROM scheduled_messages sm
         LEFT JOIN conversations cv ON cv.id = sm.conversation_id
         LEFT JOIN message_templates mt ON mt.id = sm.template_id
         LEFT JOIN automation_rules ar ON ar.id = sm.rule_id
         WHERE sm.org_id = $1
           AND sm.scheduled_for::date = CURRENT_DATE
           AND sm.status IN ('pending', 'sent', 'failed')
         ORDER BY sm.scheduled_for ASC
         LIMIT 30`,
        [orgId]
      ),

      // ── Pending quotes (sent_to_client, no response in >3 days) ──────────
      queryMany<{
        id: string; status: string; sent_at: string | null
        days_waiting: number; person_name: string | null
        option_count: number; producer_name: string | null
      }>(
        `SELECT q.id, q.status, q.sent_at::text,
                (CURRENT_DATE - q.sent_at::date) AS days_waiting,
                pe.full_name AS person_name,
                pu.full_name AS producer_name,
                (SELECT COUNT(*) FROM quote_options WHERE quote_id = q.id)::int AS option_count
         FROM quotes q
         JOIN persons pe ON pe.id = q.person_id
         LEFT JOIN producers pr ON pr.id = q.producer_id
         LEFT JOIN users pu ON pu.id = pr.user_id
         WHERE q.org_id = $1
           AND q.status = 'sent_to_client'
           AND q.sent_at IS NOT NULL
           AND q.sent_at < NOW() - INTERVAL '3 days'
           ${assignedToMe ? 'AND q.producer_id IN (SELECT id FROM producers WHERE user_id = $2)' : ''}
         ORDER BY q.sent_at ASC
         LIMIT 15`,
        assignedToMe ? [orgId, userId] : [orgId]
      ),

      // ── Failed automation messages (last 48h) ─────────────────────────────
      queryMany<{
        id: string; scheduled_for: string; last_error: string | null
        attempts: number; template_name: string | null
        rule_name: string | null; wa_phone: string | null
      }>(
        `SELECT sm.id, sm.scheduled_for::text, sm.last_error,
                sm.attempts, mt.name AS template_name,
                ar.name AS rule_name, cv.wa_phone
         FROM scheduled_messages sm
         LEFT JOIN message_templates mt ON mt.id = sm.template_id
         LEFT JOIN automation_rules ar  ON ar.id  = sm.rule_id
         LEFT JOIN conversations cv     ON cv.id  = sm.conversation_id
         WHERE sm.org_id = $1
           AND sm.status = 'failed'
           AND sm.updated_at > NOW() - INTERVAL '48 hours'
         ORDER BY sm.updated_at DESC
         LIMIT 10`,
        [orgId]
      ),
    ])

    // Unwrap settled results — failures return empty arrays
    const unwrap = <T>(result: PromiseSettledResult<T[]>): T[] =>
      result.status === 'fulfilled' ? result.value : []

    // Summary counts
    const unreadConvsData    = unwrap(unreadConvs)
    const overdueCasesData   = unwrap(overdueCases)
    const expiringPoliciesData = unwrap(expiringPolicies)
    const scheduledTodayData = unwrap(scheduledToday)
    const pendingQuotesData  = unwrap(pendingQuotes)
    const failedMessagesData = unwrap(failedMessages)

    res.json({
      data: {
        summary: {
          unread_conversations: unreadConvsData.length,
          overdue_cases:        overdueCasesData.length,
          expiring_policies:    expiringPoliciesData.length,
          scheduled_today:      scheduledTodayData.length,
          pending_quotes:       pendingQuotesData.length,
          failed_messages:      failedMessagesData.length,
        },
        unread_conversations:  unreadConvsData,
        overdue_cases:         overdueCasesData,
        expiring_policies:     expiringPoliciesData,
        scheduled_today:       scheduledTodayData,
        pending_quotes:        pendingQuotesData,
        failed_messages:       failedMessagesData,
      },
    })
  } catch (err) { next(err) }
})
