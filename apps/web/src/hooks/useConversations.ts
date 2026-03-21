'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getConversations, getConversation, getConversationMessages,
  updateConversation, sendMessage as apiSendMessage,
  escalateConversation as apiEscalate, deescalateConversation as apiDeescalate,
  takeoverConversation as apiTakeover, releaseTakeover as apiRelease,
} from '@/lib/api/conversations'
import type {
  ConversationDetail, MessageWithSender, ListConversationsParams,
} from '@/lib/api/conversations'
import type { PaginatedResponse, Conversation } from '@adding/types'

// ─── useConversationsList ─────────────────────────────────────────────────────
export function useConversationsList(params: ListConversationsParams = {}) {
  const [data, setData]       = useState<PaginatedResponse<ConversationDetail> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const paramsKey = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await getConversations(params))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar conversaciones')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  useEffect(() => { fetch() }, [fetch])

  // Poll every 15s to catch incoming messages
  useEffect(() => {
    const id = setInterval(fetch, 15_000)
    return () => clearInterval(id)
  }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── useConversationDetail ────────────────────────────────────────────────────
export function useConversationDetail(id: string | null) {
  const [data, setData]       = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getConversation(id)
      setData(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar conversación')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── useConversationMessages ──────────────────────────────────────────────────
export function useConversationMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageWithSender[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    setError(null)
    try {
      const res = await getConversationMessages(conversationId, { limit: 50 })
      setMessages(res.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar mensajes')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { fetch() }, [fetch])

  // Poll every 5s for new messages
  useEffect(() => {
    if (!conversationId) return
    const id = setInterval(fetch, 5_000)
    return () => clearInterval(id)
  }, [conversationId, fetch])

  const appendMessage = useCallback((msg: MessageWithSender) => {
    setMessages((prev) => [...prev, msg])
  }, [])

  // Replaces an optimistic (temp) message with the real server response
  const replaceMessage = useCallback((tempId: string, real: MessageWithSender) => {
    setMessages((prev) => prev.map((m) => m.id === tempId ? real : m))
  }, [])

  return { messages, loading, error, refetch: fetch, appendMessage, replaceMessage }
}

// ─── useConversationActions ───────────────────────────────────────────────────
export function useConversationActions(
  conversationId: string | null,
  onSuccess?: () => void
) {
  const [sending, setSending]   = useState(false)
  const [acting, setActing]     = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const clearError = () => setActionError(null)

  const send = useCallback(async (
    content: string,
    type: 'manual' | 'internal' = 'manual'
  ): Promise<MessageWithSender | null> => {
    if (!conversationId || !content.trim()) return null
    setSending(true)
    setActionError(null)
    try {
      const res = await apiSendMessage(conversationId, {
        content: content.trim(),
        type,
        is_internal_note: type === 'internal',
      })
      onSuccess?.()
      return res.data as MessageWithSender
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al enviar mensaje')
      return null
    } finally {
      setSending(false)
    }
  }, [conversationId, onSuccess])

  const escalate = useCallback(async (userId: string, notes?: string) => {
    if (!conversationId) return null
    setActing(true)
    setActionError(null)
    try {
      const res = await apiEscalate(conversationId, userId, notes)
      onSuccess?.()
      return res.data
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al escalar')
      return null
    } finally { setActing(false) }
  }, [conversationId, onSuccess])

  const deescalate = useCallback(async () => {
    if (!conversationId) return null
    setActing(true)
    setActionError(null)
    try {
      const res = await apiDeescalate(conversationId)
      onSuccess?.()
      return res.data
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al quitar escalamiento')
      return null
    } finally { setActing(false) }
  }, [conversationId, onSuccess])

  const takeover = useCallback(async (force = false) => {
    if (!conversationId) return null
    setActing(true)
    setActionError(null)
    try {
      const res = await apiTakeover(conversationId, force)
      onSuccess?.()
      return res.data
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al tomar conversación')
      return null
    } finally { setActing(false) }
  }, [conversationId, onSuccess])

  const release = useCallback(async () => {
    if (!conversationId) return null
    setActing(true)
    setActionError(null)
    try {
      const res = await apiRelease(conversationId)
      onSuccess?.()
      return res.data
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al liberar conversación')
      return null
    } finally { setActing(false) }
  }, [conversationId, onSuccess])

  const changeStatus = useCallback(async (status: string) => {
    if (!conversationId) return null
    setActing(true)
    setActionError(null)
    try {
      const res = await updateConversation(conversationId, { status })
      onSuccess?.()
      return res.data
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al cambiar estado')
      return null
    } finally { setActing(false) }
  }, [conversationId, onSuccess])

  return { send, escalate, deescalate, takeover, release, changeStatus, sending, acting, actionError, clearError }
}

// ─── useCurrentUser ───────────────────────────────────────────────────────────
import { getMe } from '@/lib/api/users'
import type { CurrentUser } from '@/lib/api/users'

export function useCurrentUser() {
  const [user, setUser]       = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return { user, loading }
}

// ─── useOrgUsers ──────────────────────────────────────────────────────────────
import { getUsers } from '@/lib/api/users'
import type { OrgUser } from '@/lib/api/users'

export function useOrgUsers(role?: string) {
  const [users, setUsers]     = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getUsers({ role, is_active: true })
      .then((res) => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [role])

  return { users, loading }
}
