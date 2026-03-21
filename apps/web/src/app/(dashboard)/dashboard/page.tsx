'use client'

import { usePoliciesDashboard, useExpiringPolicies } from '@/hooks/usePolicies'
import { PolicyStatusCard } from '@/components/domain/policies/PolicyStatusCard'
import { ExpiringPoliciesTable } from '@/components/domain/policies/ExpiringPoliciesTable'
import { ErrorAlert } from '@/components/ui/ErrorAlert'

export default function DashboardPage() {
  const { data: summary, loading: summaryLoading, error: summaryError } = usePoliciesDashboard()
  const { data: expiring, loading: expiringLoading, error: expiringError } = useExpiringPolicies(30)

  return (
    <div className="space-y-6 max-w-screen-xl">

      {/* Summary error */}
      {summaryError && !summaryLoading && (
        <ErrorAlert message={summaryError} />
      )}

      {/* KPI grid — 2 cols mobile, 4 desktop */}
      <section>
        <h2 className="text-xs font-500 text-ink-tertiary uppercase tracking-wide mb-3">
          Resumen de cartera
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PolicyStatusCard
            label="Pólizas activas"
            value={summary?.total_active ?? 0}
            variant="success"
            loading={summaryLoading}
          />
          <PolicyStatusCard
            label="Por vencer (30d)"
            value={summary?.total_expiring_30 ?? 0}
            variant={
              (summary?.total_expiring_30 ?? 0) > 0 ? 'warning' : 'default'
            }
            loading={summaryLoading}
          />
          <PolicyStatusCard
            label="Vencen esta semana"
            value={summary?.total_expiring_7 ?? 0}
            variant={
              (summary?.total_expiring_7 ?? 0) > 0 ? 'danger' : 'muted'
            }
            loading={summaryLoading}
          />
          <PolicyStatusCard
            label="Renovadas"
            value={summary?.total_renewed ?? 0}
            variant="muted"
            loading={summaryLoading}
          />
        </div>
      </section>

      {/* Secondary row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <PolicyStatusCard
          label="Vencen en 15d"
          value={summary?.total_expiring_15 ?? 0}
          variant={(summary?.total_expiring_15 ?? 0) > 0 ? 'warning' : 'muted'}
          loading={summaryLoading}
        />
        <PolicyStatusCard
          label="Vencidas"
          value={summary?.total_expired ?? 0}
          variant="muted"
          loading={summaryLoading}
        />
        <PolicyStatusCard
          label="Canceladas"
          value={summary?.total_cancelled ?? 0}
          variant="muted"
          loading={summaryLoading}
        />
      </div>

      {/* Expiring table */}
      <ExpiringPoliciesTable
        data={expiring}
        loading={expiringLoading}
        error={expiringError}
      />
    </div>
  )
}
