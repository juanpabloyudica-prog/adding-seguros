'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, Search, Plus, MessageSquare, FileText, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { useCases } from '@/hooks/useCases'
import { useCurrentUser } from '@/hooks/useConversations'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/shared/Pagination'
import { CaseStatusBadge } from '@/components/domain/cases/CaseStatusBadge'
import { CasePriorityBadge } from '@/components/domain/cases/CasePriorityBadge'

const CASE_TYPE_LABELS: Record<string, string> = {
  prospecto:    'Prospecto',    recotizacion: 'Recotización',
  incidencia:   'Incidencia',   siniestro:    'Siniestro',
  reclamo:      'Reclamo',      consulta:     'Consulta',
  endoso:       'Endoso',       otros:        'Otros',
}

function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

function openFor(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const days   = Math.floor(diffMs / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return '1d'
  return `${days}d`
}

const QUICK_FILTERS = [
  { id: 'all',      label: 'Todos'          },
  { id: 'mine',     label: 'Asignados a mí' },
  { id: 'open',     label: 'Abiertos'       },
  { id: 'urgent',   label: 'Urgentes'       },
  { id: 'overdue',  label: 'Vencidos'       },
] as const

export default function GestionesPage() {
  const router = useRouter()
  const { user: me } = useCurrentUser()

  const [search,      setSearch]      = useState('')
  const [type,        setType]        = useState<string | undefined>()
  const [status,      setStatus]      = useState<string | undefined>()
  const [page,        setPage]        = useState(1)
  const [activeFilter, setFilter]     = useState<string>('all')
  const [assignedToMe, setAssigned]   = useState(false)
  const [openOnly,    setOpenOnly]    = useState(false)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [priorityFilter, setPriority] = useState<string | undefined>()

  const debouncedSearch = useDebounce(search, 350)

  const applyFilter = useCallback((id: string) => {
    setFilter(id); setPage(1)
    setAssigned(false); setOpenOnly(false); setOverdueOnly(false); setPriority(undefined); setStatus(undefined)
    switch (id) {
      case 'mine':    setAssigned(true);                 break
      case 'open':    setOpenOnly(true);                 break
      case 'urgent':  setPriority('urgent');             break
      case 'overdue': setOverdueOnly(true);              break
    }
  }, [])

  const { data, loading, error, refetch } = useCases({
    search:               debouncedSearch || undefined,
    type,
    status,
    priority:             priorityFilter,
    assigned_to_user_id:  assignedToMe && me ? me.id : undefined,
    open_only:            openOnly || undefined,
    overdue_only:         overdueOnly || undefined,
    page,
    limit: 20,
  })

  return (
    <div className="space-y-4 max-w-screen-xl">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar por título o persona…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Type filter */}
        <select
          value={type ?? ''}
          onChange={e => { setType(e.target.value || undefined); setPage(1) }}
          className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(CASE_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <Button
          variant="primary" size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => router.push('/gestiones/nueva')}
          className="sm:ml-auto"
        >
          Nuevo caso
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex gap-1.5 flex-wrap">
        {QUICK_FILTERS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => applyFilter(id)}
            className={clsx(
              'px-3 h-7 rounded-full text-xs font-500 transition-colors',
              activeFilter === id
                ? 'bg-brand text-white'
                : 'bg-surface-muted text-ink-secondary hover:bg-surface-border'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Caso / Persona</th>
                <th className="hidden sm:table-cell">Tipo</th>
                <th>Estado</th>
                <th className="hidden md:table-cell">Paso actual</th>
                <th className="hidden lg:table-cell">Prioridad</th>
                <th className="hidden lg:table-cell">Asignado</th>
                <th>Abierto</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : data?.data.map(c => {
                    const isOverdue = c.is_overdue

                    return (
                      <tr
                        key={c.id}
                        onClick={() => router.push(`/gestiones/${c.id}`)}
                        className="cursor-pointer"
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <p className={clsx('text-sm font-500 truncate max-w-[180px]',
                              isOverdue ? 'text-danger' : 'text-ink')}>
                              {c.title}
                            </p>
                            {/* Badges */}
                            {(c.unread_conversation_count ?? 0) > 0 ? (
                              <span title={`${c.unread_conversation_count} conversación con mensajes sin leer`}
                                className="shrink-0 flex items-center gap-0.5 text-2xs text-white bg-brand px-1.5 py-0.5 rounded-full font-600 animate-pulse">
                                <MessageSquare className="w-2.5 h-2.5" />{c.unread_conversation_count}
                              </span>
                            ) : (c.conversation_count ?? 0) > 0 ? (
                              <span title={`${c.conversation_count} conversación activa`}
                                className="shrink-0 flex items-center gap-0.5 text-2xs text-brand bg-brand/10 px-1.5 py-0.5 rounded-full font-500">
                                <MessageSquare className="w-2.5 h-2.5" />{c.conversation_count}
                              </span>
                            ) : null}
                            {(c.document_count ?? 0) > 0 && (
                              <span title={`${c.document_count} documento${(c.document_count??0) !== 1 ? 's' : ''}`}
                                className="shrink-0 flex items-center gap-0.5 text-2xs text-ink-secondary bg-surface-muted px-1.5 py-0.5 rounded-full font-500">
                                <FileText className="w-2.5 h-2.5" />{c.document_count}
                              </span>
                            )}
                          </div>
                          {c.person && (
                            <p className="text-xs text-ink-tertiary truncate max-w-[200px]">
                              {c.person.full_name}
                            </p>
                          )}
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className="text-xs text-ink-secondary">
                            {CASE_TYPE_LABELS[c.type] ?? c.type}
                          </span>
                        </td>
                        <td><CaseStatusBadge status={c.status} /></td>
                        <td className="hidden md:table-cell">
                          {c.current_step_key
                            ? <span className="text-xs text-ink-secondary">{c.current_step_key}</span>
                            : <span className="text-ink-tertiary text-xs">—</span>}
                        </td>
                        <td className="hidden lg:table-cell">
                          <CasePriorityBadge priority={c.priority} />
                        </td>
                        <td className="hidden lg:table-cell text-sm text-ink-secondary">
                          {c.assigned_to?.full_name?.split(' ')[0] ?? <span className="text-ink-tertiary">—</span>}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {isOverdue && (
                              <AlertCircle className="w-3 h-3 text-danger shrink-0" />
                            )}
                            <span className={clsx('text-xs tabular-nums font-mono',
                              isOverdue ? 'text-danger font-600' : 'text-ink-tertiary')}>
                              {openFor(c.created_at)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {!loading && (data?.data.length ?? 0) === 0 && !error && (
          <EmptyState
            icon={<FolderOpen className="w-5 h-5" />}
            title={search ? 'Sin resultados' : 'Sin gestiones'}
            description={
              search
                ? `No se encontraron gestiones con "${search}".`
                : activeFilter === 'all'
                  ? 'No hay gestiones registradas todavía.'
                  : 'No hay gestiones en esta vista.'
            }
            action={!search && activeFilter === 'all' && (
              <Button variant="primary" size="sm"
                onClick={() => router.push('/gestiones/nueva')}>
                Nueva gestión
              </Button>
            )}
          />
        )}

        {data && data.totalPages > 1 && (
          <div className="px-4 pb-3">
            <Pagination page={data.page} totalPages={data.totalPages}
              total={data.total} limit={data.limit} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
