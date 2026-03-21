import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { TableRowSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { PolicyWithComputed } from '@/lib/api/policies'

function daysLabel(n: number): string {
  if (n < 0)  return 'Vencida'
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  return `${n}d`
}

function daysVariant(n: number): 'danger' | 'warning' | 'muted' {
  if (n <= 7)  return 'danger'
  if (n <= 15) return 'warning'
  return 'muted'
}

interface Props {
  data:    PolicyWithComputed[]
  loading: boolean
  error:   string | null
}

export function ExpiringPoliciesTable({ data, loading, error }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-600 text-ink">Próximos vencimientos</h2>
        <Link href="/polizas/vencimientos" className="text-xs text-brand hover:underline">
          Ver todos
        </Link>
      </div>

      {error ? (
        <p className="p-4 text-sm text-danger">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="hidden sm:table-cell">Compañía</th>
                <th className="hidden md:table-cell">Ramo</th>
                <th>Vence</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
                : data.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-surface-subtle transition-colors"
                      onClick={() => window.location.href = `/polizas/${p.id}`}
                    >
                      <td className="font-500 text-ink">
                        {p.person?.full_name ?? '—'}
                      </td>
                      <td className="hidden sm:table-cell text-ink-secondary">
                        {p.company?.short_name ?? p.company?.name ?? '—'}
                      </td>
                      <td className="hidden md:table-cell text-ink-secondary text-xs uppercase tracking-wide">
                        {p.ramo}
                      </td>
                      <td>
                        <Badge
                          variant={daysVariant(p.days_until_expiry)}
                          className="font-mono"
                        >
                          {daysLabel(p.days_until_expiry)}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={p.computed_status} />
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>

          {!loading && data.length === 0 && (
            <EmptyState
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Sin vencimientos próximos"
              description="No hay pólizas por vencer en los próximos 30 días."
            />
          )}
        </div>
      )}
    </div>
  )
}
