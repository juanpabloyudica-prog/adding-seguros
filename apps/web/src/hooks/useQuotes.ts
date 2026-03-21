'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getQuotes, getQuote,
  markQuoteAsSent as apiMarkSent,
  selectQuoteOption as apiSelectOption,
  updateQuoteOption as apiUpdateOption,
  deleteQuoteOption as apiDeleteOption,
  updateQuote as apiUpdateQuote,
} from '@/lib/api/quotes'
import type { QuoteDetail, QuoteListItem, ListQuotesParams } from '@/lib/api/quotes'
import type { PaginatedResponse } from '@adding/types'

export function useQuotes(params: ListQuotesParams = {}) {
  const [data, setData]       = useState<PaginatedResponse<QuoteListItem> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await getQuotes(params)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar cotizaciones') }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useQuoteDetail(id: string | null) {
  const [data, setData]       = useState<QuoteDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try { setData((await getQuote(id)).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar cotización') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useQuoteActions(id: string | null, onSuccess?: () => void) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setActing(true); setError(null)
    try { const r = await fn(); onSuccess?.(); return r }
    catch (e) { setError(e instanceof Error ? e.message : 'Error'); return null }
    finally { setActing(false) }
  }, [onSuccess])

  const markSent = (optionIds: string[], pdfUrl?: string) =>
    id ? wrap(() => apiMarkSent(id, optionIds, pdfUrl)) : Promise.resolve(null)

  const selectOption = (optionId: string, reason?: string) =>
    id ? wrap(() => apiSelectOption(id, optionId, reason)) : Promise.resolve(null)

  const toggleSentToClient = (optionId: string, currentValue: boolean) =>
    id ? wrap(() => apiUpdateOption(id, optionId, { is_sent_to_client: !currentValue })) : Promise.resolve(null)

  const removeOption = (optionId: string) =>
    id ? wrap(() => apiDeleteOption(id, optionId)) : Promise.resolve(null)

  const updateRecommendation = (text: string) =>
    id ? wrap(() => apiUpdateQuote(id, { internal_recommendation: text })) : Promise.resolve(null)

  return { markSent, selectOption, toggleSentToClient, removeOption, updateRecommendation, acting, error, clearError: () => setError(null) }
}
