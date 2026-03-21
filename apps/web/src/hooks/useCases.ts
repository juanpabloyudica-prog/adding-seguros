'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getCases, getCase,
  transitionCaseStatus, transitionCaseStep,
  closeCase as apiCloseCase, addCaseNote, updateCase,
} from '@/lib/api/cases'
import type { CaseDetail, ListCasesParams } from '@/lib/api/cases'
import type { PaginatedResponse } from '@adding/types'

export function useCases(params: ListCasesParams = {}) {
  const [data, setData]       = useState<PaginatedResponse<CaseDetail> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await getCases(params)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar casos') }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useCaseDetail(id: string | null) {
  const [data, setData]       = useState<CaseDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try { setData((await getCase(id)).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar caso') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useCaseActions(id: string | null, onSuccess?: () => void) {
  const [acting, setActing]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setActing(true); setError(null)
    try {
      const result = await fn()
      onSuccess?.()
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      return null
    } finally { setActing(false) }
  }, [onSuccess])

  const changeStatus = (status: string, notes?: string) =>
    id ? wrap(() => transitionCaseStatus(id, status, notes)) : Promise.resolve(null)

  const changeStep = (stepKey: string, notes?: string) =>
    id ? wrap(() => transitionCaseStep(id, stepKey, notes)) : Promise.resolve(null)

  const close = (result: string, result_type: string, notes?: string) =>
    id ? wrap(() => apiCloseCase(id, { result, result_type, notes })) : Promise.resolve(null)

  const addNote = (notes: string) =>
    id ? wrap(() => addCaseNote(id, notes)) : Promise.resolve(null)

  const update = (body: Record<string, unknown>) =>
    id ? wrap(() => updateCase(id, body)) : Promise.resolve(null)

  return { changeStatus, changeStep, close, addNote, update, acting, error, clearError: () => setError(null) }
}
