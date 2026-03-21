'use client'

import { useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, FolderOpen } from 'lucide-react'
import { clsx } from 'clsx'
import {
  useConversationDetail,
  useConversationMessages,
  useConversationActions,
  useCurrentUser,
  useOrgUsers} from '@/hooks/useConversations'
import { MessageBubble } from '@/components/domain/conversations/MessageBubble'
import { MessageComposer } from '@/components/domain/conversations/MessageComposer'
import { ConversationPanel } from '@/components/domain/conversations/ConversationPanel'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'
import { useToast } from '@/components/ui/Toast'
import { CaseStatusBadge } from '@/components/domain/cases/CaseStatusBadge'
import { TriggerRuleModal } from '@/components/domain/automations/TriggerRuleModal'
import { ConversationStatusBadge } from '@/components/domain/conversations/ConversationStatusBadge'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Thread skeleton ──────────────────────────────────────────────────────────
function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-start"><Skeleton className="h-10 w-48 rounded-2xl rounded-bl-sm" /></div>
      <div className="flex justify-end"> <Skeleton className="h-10 w-56 rounded-2xl rounded-br-sm" /></div>
      <div className="flex justify-start"><Skeleton className="h-14 w-64 rounded-2xl rounded-bl-sm" /></div>
      <div className="flex justify-end"> <Skeleton className="h-10 w-40 rounded-2xl rounded-br-sm" /></div>

      {showTrigger && conv && (
        <TriggerRuleModal
          conversationId={id}
          personName={conv.person?.full_name}
          onClose={() => setShowTrigger(false)}
        />
      )}

      {showNewCase && conv && (
        <NewCaseModal
          personId={conv.person?.id}
          personName={conv.person?.full_name}
          conversationId={id}
          onClose={() => setShowNewCase(false)}
        />
      )}
    </div>
  )
}

// ─── Takeover banner ──────────────────────────────────────────────────────────
function TakeoverBanner({
  lockedByName, onTakeover, acting}: { lockedByName: string; onTakeover: () => void; acting: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-warning-bg border-b border-warning/20">
      <AlertCircle className="w-4 h-4 text-warning shrink-0" />
      <p className="text-sm text-ink flex-1">
        <span className="font-500">{lockedByName}</span> tiene esta conversación tomada
      </p>
      <button
        onClick={onTakeover}
        disabled={acting}
        className="text-xs font-500 text-warning hover:underline shrink-0"
      >
        Tomar de todas formas
      </button>

      {showTrigger && conv && (
        <TriggerRuleModal
          conversationId={id}
          personName={conv.person?.full_name}
          onClose={() => setShowTrigger(false)}
        />
      )}

      {showNewCase && conv && (
        <NewCaseModal
          personId={conv.person?.id}
          personName={conv.person?.full_name}
          conversationId={id}
          onClose={() => setShowNewCase(false)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConversacionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [showNewCase,    setShowNewCase]    = useState(false)
  const [showTrigger,   setShowTrigger]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: conv,     loading: convLoading,  error: convError,  refetch: refetchConv }  = useConversationDetail(id)
  const { messages,       loading: msgsLoading,  error: msgsError,  appendMessage, replaceMessage } = useConversationMessages(id)
  const { user: me,       loading: meLoading }                                               = useCurrentUser()
  const { users: orgUsers }                                                                  = useOrgUsers()

  const onActionSuccess = useCallback(() => refetchConv(), [refetchConv])

  const { send, escalate, deescalate, takeover, release, changeStatus, sending, acting, actionError, clearError } =
    useConversationActions(id, onActionSuccess)
  const { success: toastSuccess, error: toastError } = useToast()

  // Show toast when conversation actions fail
  useEffect(() => {
    if (actionError) toastError('Error en la acción', actionError)
  }, [actionError, toastError])

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(async (content: string, type: 'manual' | 'internal') => {
    if (!me || !content.trim()) return null

    // ── Optimistic: show message immediately with pending status ──────────
    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: MessageWithSender = {
      id:               optimisticId,
      org_id:           '',
      conversation_id:  id,
      sent_by_user_id:  me.id,
      created_by:       me.id,
      direction:        'outbound',
      type,
      content,
      payload:          {},
      media_url:        null,
      media_type:       null,
      wa_message_id:    null,
      status:           'pending',
      error_detail:     null,
      signature_used:   null,
      template_id:      null,
      is_internal_note: type === 'internal',
      sent_at:          new Date().toISOString(),
      sender_name:      me.full_name}
    appendMessage(optimisticMsg)

    // ── Real send ─────────────────────────────────────────────────────────
    const realMsg = await send(content, type)
    if (realMsg) {
      // Replace the optimistic message with the real one from the server
      replaceMessage(optimisticId, realMsg)
    } else {
      // Mark optimistic message as failed
      replaceMessage(optimisticId, { ...optimisticMsg, status: 'failed' })
      toastError('No se pudo enviar el mensaje')
    }
    return realMsg
  }, [send, appendMessage, replaceMessage, id, me])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (convLoading || meLoading) {
    return (
      <div className="flex flex-col h-[calc(100dvh-56px)] max-w-5xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border bg-surface">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-5 w-40 rounded" />
        </div>
        <ThreadSkeleton />
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (convError) {
    return (
      <div className="p-4 space-y-3 max-w-2xl">
        <Link href="/conversaciones" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Conversaciones
        </Link>
        <ErrorAlert message={convError} />
      </div>
    )
  }

  if (!conv) return null

  const isLockedByOther = conv.locked_by_user_id && conv.locked_by_user_id !== me?.id
  const isClosed        = conv.status === 'closed'
  const displayName     = conv.person?.full_name ?? conv.wa_contact_name ?? conv.wa_phone

  return (
    <div className="flex h-[calc(100dvh-56px)] max-w-5xl -m-4 md:-m-6">

      {/* ── Left: thread ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-surface-border">

        {/* Thread header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-surface-border bg-surface shrink-0">
          <Link
            href="/conversaciones"
            className="p-1.5 -ml-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-600 text-ink truncate">{displayName}</p>
              <ConversationStatusBadge status={conv.status} />
              {conv.escalated_to && (
                <span className="text-2xs text-danger bg-danger-bg border border-danger/20 px-1.5 py-0.5 rounded-full">
                  Escalada → {conv.escalated_to.full_name}
                </span>
              )}
            </div>
            <p className="text-2xs text-ink-tertiary font-mono">{conv.wa_phone}</p>
          </div>
        </div>

        {/* Takeover banner */}
        {isLockedByOther && conv.locked_by && (
          <TakeoverBanner
            lockedByName={conv.locked_by.full_name}
            onTakeover={() => takeover(true)}
            acting={acting}
          />
        )}

        {/* Linked case banner */}
        {conv.linked_case ? (
          <Link href={`/gestiones/${conv.linked_case.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-brand/5 border-b border-brand/20 hover:bg-brand/10 transition-colors">
            <FolderOpen className="w-3.5 h-3.5 text-brand shrink-0" />
            <span className="text-xs font-500 text-brand">Gestión vinculada:</span>
            <span className="text-xs text-ink truncate flex-1">{conv.linked_case.title}</span>
            <CaseStatusBadge status={conv.linked_case.status} />
          </Link>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-surface-border bg-surface-subtle">
            <FolderOpen className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
            <span className="text-xs text-ink-tertiary">Sin gestión vinculada</span>
            <button onClick={() => setShowNewCase(true)}
              className="text-xs text-brand hover:underline ml-auto">
              + Crear gestión
            </button>
          </div>
        )}

        {/* Action error */}
        {actionError && (
          <div className="px-4 pt-3">
            <ErrorAlert message={actionError} onRetry={clearError} />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {msgsLoading ? (
            <ThreadSkeleton />
          ) : msgsError ? (
            <ErrorAlert message={msgsError} />
          ) : messages.length === 0 ? (
            <EmptyState
              title="Sin mensajes aún"
              description="Los mensajes de esta conversación aparecerán aquí."
            />
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <MessageComposer
          onSend={handleSend}
          sending={sending}
          disabled={isClosed}
          placeholder={isClosed ? 'Esta conversación está cerrada' : undefined}
        />
      </div>

      {/* ── Right: panel — hidden on mobile, visible on lg+ ────────────────── */}
      <div className="hidden lg:flex w-72 xl:w-80 shrink-0 flex-col">
        {me && (
          <ConversationPanel
            conversation={conv}
            currentUserId={me.id}
            orgUsers={orgUsers}
            onEscalate={async (userId) => { await escalate(userId); toastSuccess('Conversación escalada') }}
            onDeescalate={async () => { await deescalate(); toastSuccess('Escalamiento removido') }}
            onTakeover={async (force) => { await takeover(force ?? false); toastSuccess('Tomaste el control de la conversación') }}
            onRelease={async () => { await release(); toastSuccess('Control liberado') }}
            onStatusChange={async (s) => { await changeStatus(s); toastSuccess('Estado de conversación actualizado') }}
            acting={acting}
          />
        )}
      </div>

      {showTrigger && conv && (
        <TriggerRuleModal
          conversationId={id}
          personName={conv.person?.full_name}
          onClose={() => setShowTrigger(false)}
        />
      )}

      {showNewCase && conv && (
        <NewCaseModal
          personId={conv.person?.id}
          personName={conv.person?.full_name}
          conversationId={id}
          onClose={() => setShowNewCase(false)}
        />
      )}
    </div>
  )
}
