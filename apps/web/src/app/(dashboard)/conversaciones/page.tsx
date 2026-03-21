'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { useConversationsList, useCurrentUser } from '@/hooks/useConversations'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConversationStatusBadge } from '@/components/domain/conversations/ConversationStatusBadge'
import { Pagination } from '@/components/shared/Pagination'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days  = Math.floor(hours / 24)
  if (mins < 1)   return 'ahora'
  if (mins < 60)  return `${mins}m`
  if (hours < 24) return `${hours}h`
  if (days < 7)   return `${days}d`
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Skeleton row ──────────────────────────────────────────────────────────────
function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-3 w-48 rounded" />
      </div>
      <Skeleton className="h-3 w-8 rounded shrink-0" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConversacionesPage() {
  const router = useRouter()
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState<string | undefined>(undefined)
  const [page, setPage]           = useState(1)
  const [unreadOnly, setUnread]   = useState(false)
  const [assignedToMe, setAssigned] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const debSearch = useDebounce(search, 350)

  // ─── Quick filter config ─────────────────────────────────────────────────
  const QUICK_FILTERS = [
    { id: 'all',         label: 'Todas'           },
    { id: 'unread',      label: 'No leídas'       },
    { id: 'mine',        label: 'Asignadas a mí'  },
    { id: 'escalated',   label: 'Escaladas'       },
    { id: 'open',        label: 'Abiertas'        },
    { id: 'resolved',    label: 'Resueltas'       },
  ] as const

  // Using useCurrentUser from hook to get current user id for "mine" filter
  const { user: me } = useCurrentUser()

  const applyQuickFilter = useCallback((filterId: string) => {
    setActiveFilter(filterId)
    setPage(1)
    setUnread(false)
    setStatus(undefined)
    setAssigned(false)
    switch (filterId) {
      case 'unread':    setUnread(true); break
      case 'mine':      setAssigned(true); break
      case 'escalated': setStatus('escalated'); break
      case 'open':      setStatus('open'); break
      case 'resolved':  setStatus('resolved'); break
      default: break
    }
  }, [])

  const { data, loading, error, refetch } = useConversationsList({
    search:               debSearch || undefined,
    status,
    unread_only:          unreadOnly || undefined,
    assigned_to_user_id:  assignedToMe && me ? me.id : undefined,
    page,
    limit: 30,
  })

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1)
  }, [])

  return (
    <div className="flex flex-col h-full max-h-[calc(100dvh-56px)] max-w-2xl">

      {/* Toolbar */}
      <div className="space-y-3 pb-3">
        {/* Search */}
        <Input
          placeholder="Buscar por teléfono o nombre…"
          value={search}
          onChange={handleSearch}
          icon={<Search className="w-3.5 h-3.5" />}
        />

        {/* Quick filters */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_FILTERS.map(({ id: fid, label }) => (
            <button
              key={fid}
              onClick={() => applyQuickFilter(fid)}
              className={clsx(
                'px-3 h-7 rounded-full text-xs font-500 transition-colors whitespace-nowrap',
                activeFilter === fid
                  ? 'bg-brand text-white'
                  : 'bg-surface-muted text-ink-secondary hover:bg-surface-border'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* List */}
      <div className="card overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {loading && !data ? (
            Array.from({ length: 8 }).map((_, i) => <ConversationSkeleton key={i} />)
          ) : (data?.data.length ?? 0) === 0 && !loading ? (
            <EmptyState
              icon={<MessageSquare className="w-5 h-5" />}
              title={search ? 'Sin resultados' : 'Sin conversaciones'}
              description={
                search
                  ? `No se encontraron conversaciones con "${search}".`
                  : status
                    ? 'No hay conversaciones con este estado.'
                    : 'Los mensajes entrantes de WhatsApp aparecerán aquí automáticamente.'
              }
            />
          ) : (
            data?.data.map((conv) => {
              const name = conv.person?.full_name ?? conv.wa_contact_name ?? conv.wa_phone
              const isUnread = (conv.unread_count ?? 0) > 0

              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/conversaciones/${conv.id}`)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 border-b border-surface-border',
                    'hover:bg-surface-subtle transition-colors text-left',
                    isUnread && 'bg-brand/[0.03]'
                  )}
                >
                  {/* Avatar */}
                  <div className={clsx(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-600 shrink-0',
                    'bg-surface-muted text-ink-secondary relative'
                  )}>
                    {getInitials(name)}
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-brand rounded-full border-2 border-surface flex items-center justify-center text-[9px] text-white font-600">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={clsx('text-sm truncate', isUnread ? 'font-600 text-ink' : 'text-ink')}>
                        {name}
                      </p>
                      <ConversationStatusBadge status={conv.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-ink-tertiary font-mono truncate flex-1">
                        {conv.wa_phone}
                      </p>
                      {conv.assigned_to && (
                        <span className="text-2xs text-ink-tertiary hidden sm:block shrink-0">
                          → {conv.assigned_to.full_name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                    {conv.last_message_text && (
                      <p className={clsx(
                        'text-xs mt-0.5 truncate',
                        isUnread ? 'text-ink' : 'text-ink-tertiary'
                      )}>
                        {conv.last_message_text}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <p className="text-2xs text-ink-tertiary shrink-0">
                    {formatRelativeTime(conv.last_message_at)}
                  </p>
                </button>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-4 pb-3 border-t border-surface-border">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit}
              onPage={setPage}
            />
          </div>
        )}
      </div>
    </div>
  )
}
