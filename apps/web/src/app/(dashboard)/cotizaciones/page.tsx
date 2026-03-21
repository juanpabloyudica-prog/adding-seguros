'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Search, Plus } from 'lucide-react'
import { clsx } from 'clsx'
import { useQuotes } from '@/hooks/useQuotes'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/shared/Pagination'
import { QuoteStatusBadge } from '@/components/domain/quotes/QuoteStatusBadge'
import { formatCurrency } from '@adding/utils'

const RISK_TYPE_LABELS: Record<string, string> = {
  auto: 'Auto', moto: 'Moto', hogar: 'Hogar', vida: 'Vida',
  accidentes: 'Accidentes', comercial: 'Comercial',
  transporte: 'Transporte', responsabilidad: 'Resp. Civil', otros: 'Otros',
}

const STATUS_FILTERS = [
  { value: undefined,        label: 'Todas'           },
  { value: 'draft',          label: 'Borrador'        },
  { value: 'options_loaded', label: 'Con opciones'    },
  { value: 'sent_to_client', label: 'Enviadas'        },
  { value: 'selected',       label: 'Con elección'    },
  { value: 'emitted',        label: 'Emitidas'        },
  { value: 'lost',           label: 'Perdidas'        },
] as const

function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CotizacionesPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [page,   setPage]   = useState(1)

  const debouncedSearch = useDebounce(search, 350)

  const { data, loading, error, refetch } = useQuotes({
    search: debouncedSearch || undefined,
    status,
    page,
    limit: 20,
  })

  return (
    <div className="space-y-4 max-w-screen-xl">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar por persona…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
        <Button
          variant="primary" size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => router.push('/cotizaciones/nueva')}
          className="sm:ml-auto"
        >
          Nueva cotización
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => { setStatus(value); setPage(1) }}
            className={clsx(
              'px-3 h-7 rounded-full text-xs font-500 transition-colors',
              status === value
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
                <th>Persona / Riesgo</th>
                <th>Estado</th>
                <th className="hidden sm:table-cell">Opciones</th>
                <th className="hidden md:table-cell">Productor</th>
                <th className="hidden lg:table-cell">Enviada</th>
                <th>Creada</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
                : data?.data.map(q => (
                    <tr
                      key={q.id}
                      onClick={() => router.push(`/cotizaciones/${q.id}`)}
                      className="cursor-pointer"
                    >
                      <td>
                        <p className="text-sm font-500 text-ink">{q.person?.full_name ?? '—'}</p>
                        <p className="text-2xs text-ink-tertiary uppercase tracking-wide mt-0.5">
                          {RISK_TYPE_LABELS[q.risk?.type ?? ''] ?? q.risk?.type ?? 'Riesgo'}
                        </p>
                      </td>
                      <td><QuoteStatusBadge status={q.status} /></td>
                      <td className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-ink tabular-nums">{(q as any).option_count ?? 0}</span>
                          <span className="text-ink-tertiary text-xs">analizadas</span>
                          {((q as any).sent_count ?? 0) > 0 && (
                            <>
                              <span className="text-ink-tertiary">·</span>
                              <span className="text-xs text-info font-500">{(q as any).sent_count} enviadas</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-sm text-ink-secondary">
                        {q.producer?.full_name ?? <span className="text-ink-tertiary">—</span>}
                      </td>
                      <td className="hidden lg:table-cell text-xs text-ink-secondary">
                        {q.sent_at ? formatDate(q.sent_at) : <span className="text-ink-tertiary">—</span>}
                      </td>
                      <td className="text-xs text-ink-tertiary">{formatDate(q.created_at)}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {!loading && (data?.data.length ?? 0) === 0 && !error && (
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title={search ? 'Sin resultados' : 'Sin cotizaciones'}
            description={search ? `No hay cotizaciones para "${search}".` : 'Creá la primera cotización.'}
            action={!search && (
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => router.push('/cotizaciones/nueva')}>
                Nueva cotización
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
