'use client'

import { useEffect, useState } from 'react'
import { getPoliciesDashboard, getExpiringPolicies } from '@/lib/api/policies'
import type { PolicyDashboardSummary, PolicyWithComputed } from '@/lib/api/policies'

export function usePoliciesDashboard(producerId?: string) {
  const [data, setData]       = useState<PolicyDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getPoliciesDashboard(producerId)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar pólizas'))
      .finally(() => setLoading(false))
  }, [producerId])

  return { data, loading, error }
}

export function useExpiringPolicies(days = 30) {
  const [data, setData]       = useState<PolicyWithComputed[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [count, setCount]     = useState(0)

  useEffect(() => {
    setLoading(true)
    getExpiringPolicies(days)
      .then((res) => { setData(res.data); setCount(res.meta.count) })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar pólizas'))
      .finally(() => setLoading(false))
  }, [days])

  return { data, loading, error, count }
}

import { useCallback } from 'react'
import {
  getPolicies as apiGetPolicies, getPolicy as apiGetPolicy,
  updatePolicyStatus as apiUpdateStatus, renewPolicy as apiRenew,
  updateRenewalStatus as apiUpdateRenewal,
} from '@/lib/api/policies'
import type { PolicyDetail, PolicyWithComputed } from '@/lib/api/policies'
import type { PaginatedResponse } from '@adding/types'

export interface ListPoliciesParams {
  page?:        number
  limit?:       number
  person_id?:   string
  company_id?:  string
  producer_id?: string
  status?:      string
  ramo?:        string
  search?:      string
}

export function usePolicies(params: ListPoliciesParams = {}) {
  const [data, setData]       = useState<PaginatedResponse<PolicyWithComputed> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await apiGetPolicies(params as Record<string, string | number>)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar póliza') }
    finally   { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function usePolicyDetail(id: string | null) {
  const [data, setData]       = useState<PolicyDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try { setData((await apiGetPolicy(id)).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar póliza') }
    finally   { setLoading(false) }
  }, [id])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function usePolicyActions(id: string | null, onSuccess?: () => void) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setActing(true); setError(null)
    try { const r = await fn(); onSuccess?.(); return r }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al ejecutar acción'); return null }
    finally   { setActing(false) }
  }, [onSuccess])

  const changeStatus = (status: string, cancellation_date?: string) =>
    id ? wrap(() => apiUpdateStatus(id, status, cancellation_date)) : Promise.resolve(null)

  const renew = (body: Record<string, unknown>) =>
    id ? wrap(() => apiRenew(id, body, `renew-${id}-${Date.now()}`)) : Promise.resolve(null)

  const changeRenewalStatus = (renewal_status: string) =>
    id ? wrap(() => apiUpdateRenewal(id, renewal_status)) : Promise.resolve(null)

  return { changeStatus, renew, changeRenewalStatus, acting, error, clearError: () => setError(null) }
}
