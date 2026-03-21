'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getTemplates, getRules, getScheduledMessages,
  createTemplate as apiCreateTemplate, updateTemplate as apiUpdateTemplate,
  createRule as apiCreateRule, updateRule as apiUpdateRule,
  cancelScheduledMessage as apiCancel, previewTemplate as apiPreview,
} from '@/lib/api/automations'
import type { Template, RuleDetail, ScheduledMessageDetail, ListScheduledParams } from '@/lib/api/automations'
import type { PaginatedResponse } from '@adding/types'

export function useTemplates() {
  const [data, setData]       = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData((await getTemplates()).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar templates') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useRules() {
  const [data, setData]       = useState<RuleDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData((await getRules()).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar reglas') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useScheduledMessages(params: ListScheduledParams = {}) {
  const [data, setData]       = useState<PaginatedResponse<ScheduledMessageDetail> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await getScheduledMessages(params)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar mensajes programados') }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}

export function useTemplateActions(onSuccess?: () => void) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const save = async (input: Record<string, unknown>, id?: string): Promise<Template | null> => {
    setActing(true); setError(null)
    try {
      const result = id
        ? (await apiUpdateTemplate(id, input)).data
        : (await apiCreateTemplate(input)).data
      onSuccess?.()
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar template')
      return null
    } finally { setActing(false) }
  }

  const preview = async (id: string, vars: Record<string, string>, body?: string): Promise<string | null> => {
    try {
      return (await apiPreview(id, vars, body)).data.preview
    } catch { return null }
  }

  return { save, preview, acting, error, clearError: () => setError(null) }
}

export function useRuleActions(onSuccess?: () => void) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const save = async (input: Record<string, unknown>, id?: string): Promise<RuleDetail | null> => {
    setActing(true); setError(null)
    try {
      const result = id
        ? (await apiUpdateRule(id, input)).data
        : (await apiCreateRule(input)).data
      onSuccess?.()
      return result
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar regla')
      return null
    } finally { setActing(false) }
  }

  const toggle = async (id: string, isActive: boolean): Promise<boolean> => {
    setActing(true); setError(null)
    try {
      await apiUpdateRule(id, { is_active: !isActive })
      onSuccess?.()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar regla')
      return false
    } finally { setActing(false) }
  }

  return { save, toggle, acting, error, clearError: () => setError(null) }
}

export function useScheduledActions(onSuccess?: () => void) {
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const cancel = async (id: string, reason?: string): Promise<boolean> => {
    setActing(true); setError(null)
    try {
      await apiCancel(id, reason)
      onSuccess?.()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar mensaje')
      return false
    } finally { setActing(false) }
  }

  return { cancel, acting, error, clearError: () => setError(null) }
}

export function useAutomationHistory(params: { page?: number; limit?: number; rule_id?: string } = {}) {
  const [data, setData]       = useState<import('@adding/types').PaginatedResponse<import('@/lib/api/automations').AutomationHistoryEntry> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const key = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { getAutomationHistory } = await import('@/lib/api/automations')
      setData(await getAutomationHistory(params))
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar historial') }
    finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch }
}
