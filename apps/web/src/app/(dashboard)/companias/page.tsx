'use client'

import { useState, useEffect } from 'react'
import { Building2, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { getCompanies, type Company } from '@/lib/api/companies'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'

function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

export default function CompaniasPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = () => {
    setLoading(true); setError(null)
    getCompanies()
      .then(r => setCompanies(r.data))
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar compañías'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const dSearch = useDebounce(search, 250)

  const filtered = companies.filter(c => {
    if (!showInactive && !c.is_active) return false
    if (!dSearch) return true
    const q = dSearch.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.short_name?.toLowerCase().includes(q) ?? false) ||
      (c.short_name?.toLowerCase().includes(q) ?? false)
    )
  })

  const activeCount   = companies.filter(c => c.is_active).length
  const inactiveCount = companies.filter(c => !c.is_active).length

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-base font-600 text-ink">Compañías</h1>
        <p className="text-xs text-ink-tertiary mt-0.5">
          {activeCount} activa{activeCount !== 1 ? 's' : ''}
          {inactiveCount > 0 && ` · ${inactiveCount} inactiva${inactiveCount !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o CUIT…"
            className="w-full h-9 pl-8 pr-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-ink-secondary cursor-pointer select-none">
          <input type="checkbox" checked={showInactive}
            onChange={e => setShowInactive(e.target.checked)}
            className="accent-brand" />
          Mostrar inactivas
        </label>
      </div>

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-surface-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-5 h-5" />}
            title={dSearch ? 'Sin resultados' : 'Sin compañías'}
            description={dSearch
              ? `No se encontraron compañías con "${dSearch}".`
              : 'No hay compañías registradas. Agregá las aseguradoras con las que trabajás.'}
          />
        ) : (
          <div className="divide-y divide-surface-border">
            {filtered
              .sort((a, b) => (b.ranking ?? 0) - (a.ranking ?? 0) || a.name.localeCompare(b.name))
              .map(c => (
                <div key={c.id}
                  className={clsx('flex items-center gap-3 px-4 py-3', !c.is_active && 'opacity-55')}>
                  {/* Logo or initial */}
                  <div className="w-9 h-9 rounded-lg bg-surface-muted flex items-center justify-center shrink-0 overflow-hidden border border-surface-border">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-sm font-700 text-ink-secondary">
                        {c.short_name?.[0] ?? c.name[0]}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-500 text-ink">{c.name}</p>
                      {c.short_name && c.short_name !== c.name && (
                        <span className="text-xs text-ink-tertiary">({c.short_name})</span>
                      )}
                      {!c.is_active && (
                        <Badge variant="muted" className="text-2xs">Inactiva</Badge>
                      )}
                      {c.ranking && c.ranking >= 4 && (
                        <Badge variant="success" className="text-2xs">Destacada</Badge>
                      )}
                    </div>
                    {c.cuit && (
                      <p className="text-xs text-ink-tertiary font-mono mt-0.5">CUIT {c.cuit}</p>
                    )}
                  </div>


                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
