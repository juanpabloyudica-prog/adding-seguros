'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Users, Building2 } from 'lucide-react'
import { usePersons } from '@/hooks/usePersons'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/shared/Pagination'
import { clsx } from 'clsx'

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function PersonasPage() {
  const router = useRouter()
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [isCompany, setIsCompany] = useState<boolean | undefined>(undefined)

  // Debounce search to avoid a request per keystroke
  const debouncedSearch = useDebounce(search, 350)

  const { data, loading, error, refetch } = usePersons({
    search:     debouncedSearch || undefined,
    page,
    limit:      20,
    is_company: isCompany,
  })

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }, [])

  const handleFilterCompany = useCallback((val: boolean | undefined) => {
    setIsCompany(val)
    setPage(1)
  }, [])

  return (
    <div className="space-y-4 max-w-screen-xl">

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar por nombre, documento, teléfono…"
            value={search}
            onChange={handleSearch}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Type filter pills */}
        <div className="flex items-center gap-1.5">
          {[
            { label: 'Todos',     value: undefined },
            { label: 'Personas',  value: false      },
            { label: 'Empresas',  value: true       },
          ].map(({ label, value }) => (
            <button
              key={label}
              onClick={() => handleFilterCompany(value)}
              className={clsx(
                'px-3 h-9 rounded-lg text-sm transition-colors duration-100',
                isCompany === value
                  ? 'bg-brand text-white font-500'
                  : 'bg-surface border border-surface-border text-ink-secondary hover:bg-surface-subtle'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* New person button */}
        <Button
          variant="primary"
          size="md"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => router.push('/personas/nueva')}
          className="sm:ml-auto"
        >
          Nueva persona
        </Button>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={refetch} />}

      {/* Table card */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th className="hidden sm:table-cell">Documento</th>
                <th className="hidden md:table-cell">Teléfono</th>
                <th className="hidden lg:table-cell">Productor</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={5} />
                ))
              ) : data?.data.map((person) => (
                <tr
                  key={person.id}
                  onClick={() => router.push(`/personas/${person.id}`)}
                  className="cursor-pointer"
                >
                  {/* Name + company icon */}
                  <td>
                    <div className="flex items-center gap-2">
                      <div className={clsx(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-600 shrink-0',
                        person.is_company
                          ? 'bg-brand/10 text-brand'
                          : 'bg-surface-muted text-ink-secondary'
                      )}>
                        {person.is_company
                          ? <Building2 className="w-3.5 h-3.5" />
                          : person.full_name[0]?.toUpperCase()
                        }
                      </div>
                      <div>
                        <p className="text-sm font-500 text-ink leading-tight">
                          {person.full_name}
                        </p>
                        {/* Email visible on mobile where doc col is hidden */}
                        {person.email && (
                          <p className="text-2xs text-ink-tertiary sm:hidden">{person.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Document */}
                  <td className="hidden sm:table-cell">
                    {person.doc_type && person.doc_number ? (
                      <span className="font-mono text-xs text-ink-secondary">
                        {person.doc_type} {person.doc_number}
                      </span>
                    ) : (
                      <span className="text-ink-tertiary">—</span>
                    )}
                  </td>

                  {/* Phone */}
                  <td className="hidden md:table-cell text-sm text-ink-secondary">
                    {person.phone ?? <span className="text-ink-tertiary">—</span>}
                  </td>

                  {/* Producer */}
                  <td className="hidden lg:table-cell text-sm text-ink-secondary">
                    {/* producer comes joined only in the detail, not in list */}
                    <span className="text-ink-tertiary text-xs">—</span>
                  </td>

                  {/* Tags */}
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(person.tags ?? []).slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="muted" className="text-2xs">{tag}</Badge>
                      ))}
                      {(person.tags ?? []).length > 3 && (
                        <Badge variant="muted" className="text-2xs">
                          +{(person.tags ?? []).length - 3}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {!loading && (data?.data.length ?? 0) === 0 && !error && (
          <EmptyState
            icon={<Users className="w-5 h-5" />}
            title={search ? 'Sin resultados' : 'Sin personas registradas'}
            description={
              search
                ? `No se encontraron personas con "${search}".`
                : 'Agregá la primera persona para comenzar.'
            }
            action={
              !search && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => router.push('/personas/nueva')}
                >
                  Nueva persona
                </Button>
              )
            }
          />
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="px-4 pb-3">
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
