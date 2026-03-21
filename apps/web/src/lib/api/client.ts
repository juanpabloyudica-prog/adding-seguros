import { getSupabaseClient } from '@/lib/supabase/client'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(): Promise<string | null> {
  const supabase = getSupabaseClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...init } = options

  // Build URL with query params
  const url = new URL(`${API_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const token = await getToken()

  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url.toString(), { ...init, headers })

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: unknown } } = {}
    try { body = await res.json() } catch { /* ignore */ }
    // For validation errors, build a readable message from field details
    let errorMessage = body.error?.message ?? `HTTP ${res.status}`
    if (body.error?.code === 'VALIDATION_ERROR' && Array.isArray(body.error?.details)) {
      const fields = (body.error.details as { path: string; message: string }[])
        .map(d => `${d.path}: ${d.message}`)
        .join(', ')
      errorMessage = `Datos inválidos: ${fields}`
    } else if (body.error?.code === 'VALIDATION_ERROR') {
      errorMessage = 'Los datos enviados no son válidos'
    }
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN',
      errorMessage,
      res.status,
      body.error?.details
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ─── Convenience helpers ──────────────────────────────────────────────────────
export const apiGet = <T>(path: string, params?: FetchOptions['params']) =>
  apiFetch<T>(path, { method: 'GET', params })

export const apiPost = <T>(path: string, body: unknown, idempotencyKey?: string) =>
  apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  })

export const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) })

export const apiDelete = <T>(path: string) =>
  apiFetch<T>(path, { method: 'DELETE' })
