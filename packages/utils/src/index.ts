import { createHash } from 'crypto'

// ─── Template variable resolver ───────────────────────────────────────────────
/**
 * Resolves {{variable}} placeholders in a template body.
 * Unknown variables are left as-is with a [?] marker.
 */
export function resolveTemplate(
  body: string,
  variables: Record<string, string>
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return key in variables ? (variables[key] ?? match) : `[?${key}]`
  })
}

/**
 * Extracts all {{variable}} names declared in a template body.
 */
export function extractTemplateVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map((m) => m[1]).filter((v): v is string => v !== undefined))]
}

// ─── Idempotency key generation ───────────────────────────────────────────────
/**
 * Generates a deterministic idempotency key for scheduled messages.
 * Same inputs always produce the same key — prevents duplicate sends.
 */
export function generateIdempotencyKey(
  ruleId: string,
  entityId: string,
  scheduledFor: Date
): string {
  const dayStr = scheduledFor.toISOString().slice(0, 10) // YYYY-MM-DD
  const input = `${ruleId}:${entityId}:${dayStr}`
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}

// ─── Date utilities ───────────────────────────────────────────────────────────
export function isExpiringSoon(endDate: string, alertDays: number): boolean {
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= alertDays
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
}

// ─── Currency formatting ──────────────────────────────────────────────────────
export function formatCurrency(
  amount: number,
  currency: string = 'ARS'
): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function getPaginationOffset(page: number, limit: number): number {
  return (Math.max(1, page) - 1) * limit
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

// ─── String utilities ─────────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function normalizePhone(phone: string): string {
  // Strips everything except digits, ensures Argentine format
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('54')) return `+${digits}`
  if (digits.startsWith('9')) return `+54${digits}`
  return `+549${digits}`
}
