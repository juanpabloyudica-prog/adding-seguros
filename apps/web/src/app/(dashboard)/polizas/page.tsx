'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, Search, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { usePolicies } from '@/hooks/usePolicies'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/shared/Pagination'
import { PolicyStatusBadge } from '@/components/domain/policies/PolicyStatusBadge'
import { formatCurrency } from '@adding/utils'

function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_FILTERS = [
  { value: undefined,   label: 'Todas'      },
  { value: 'active',    label: 'Vigentes'   },
  { value: 'expiring',  label: 'Por vencer' },
  { value: 'expired',   label: 'Vencidas'   },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'draft',     label: 'Borrador'   },
] as const

export default function PolizasPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string | undefined>()
  const [page,   setPage]   = useState(1)

  const dSearch = useDebounce(search, 350)

  const { data, loading, error, refetch } = usePolicies({
    status,
    page,
    limit: 20,
  })

  // Client-side search filter
  const items = dSearch
    ? (data?.data ?? []).filter(p => {
        const q = dSearch.toLowerCase()
        return (
          p.person?.full_name?.toLowerCase().includes(q) ||
          p.policy_number?.toLowerCase().includes(q)     ||
          p.company?.name?.toLowerCase().includes(q)     ||
          p.ramo?.toLowerCase().includes(q)
        )
      })
    : data?.data ?? []

  return (
    <div className="space-y-4 max-w-screen-xl">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar por persona, número o compañía…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
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
                <th>Persona</th>
                <th>Número</th>
                <th className="hidden sm:table-cell">Compañía</th>
                <th className="hidden sm:table-cell">Ramo</th>
                <th>Estado</th>
                <th className="hidden md:table-cell">Vigencia</th>
                <th className="hidden lg:table-cell">Prima</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={7} />)
                : items.map(p => {
                    const isExpiring = p.computed_status === 'expiring'
                    return (
                      <tr key={p.id} onClick={() => router.push(`/polizas/${p.id}`)} className="cursor-pointer">
                        <td>
                          <p className="text-sm font-500 text-ink">{p.person?.full_name ?? '—'}</p>
                        </td>
                        <td>
                          <p className="text-sm font-mono text-ink-secondary">{p.policy_number}</p>
                        </td>
                        <td className="hidden sm:table-cell text-sm text-ink-secondary">
                          {p.company?.short_name ?? p.company?.name ?? '—'}
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className="text-xs uppercase tracking-wide text-ink-secondary">{p.ramo}</span>
                        </td>
                        <td><PolicyStatusBadge status={p.computed_status} /></td>
                        <td className="hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-ink-secondary">{formatDate(p.end_date)}</span>
                            {isExpiring && (
                              <AlertTriangle className="w-3 h-3 text-warning shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="hidden lg:table-cell text-sm text-ink-secondary tabular-nums">
                          {p.premium ? formatCurrency(p.premium, p.currency) : '—'}
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
        </div>

        {!loading && items.length === 0 && !error && (
          <EmptyState
            icon={<Shield className="w-5 h-5" />}
            title={dSearch ? 'Sin resultados' : 'Sin pólizas'}
            description={
              dSearch
                ? `No se encontraron pólizas con "${dSearch}".`
                : status
                  ? 'No hay pólizas con este estado.'
                  : 'Las pólizas se generan al confirmar opciones de cotización.'
            }
          />
        )}

        {!dSearch && data && data.totalPages > 1 && (
          <div className="px-4 pb-3">
            <Pagination page={data.page} totalPages={data.totalPages}
              total={data.total} limit={data.limit} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
