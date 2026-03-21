'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AlertTriangle, Search, Building2, FolderOpen, MessageSquare, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'
import { getExpiringPolicies } from '@/lib/api/policies'
import { getProducers } from '@/lib/api/producers'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'
import { TriggerRuleModal } from '@/components/domain/automations/TriggerRuleModal'
import { getConversations } from '@/lib/api/conversations'
import type { PolicyWithComputed } from '@/lib/api/policies'
import type { ProducerListItem } from '@/lib/api/producers'

// ─── Day buckets config ────────────────────────────────────────────────────────
const DAY_BUCKETS = [
  { days: 7,  label: '7 días',  urgency: 'high'   as const },
  { days: 15, label: '15 días', urgency: 'medium' as const },
  { days: 30, label: '30 días', urgency: 'low'    as const },
] as const

type Urgency = 'high' | 'medium' | 'low'

const URGENCY_STYLES: Record<Urgency, { row: string; badge: string; label: string; badgeVariant: 'danger'|'warning'|'muted' }> = {
  high:   { row: 'bg-danger-bg/40',  badge: 'text-danger',   label: 'Vence esta semana', badgeVariant: 'danger'  },
  medium: { row: 'bg-warning-bg/30', badge: 'text-warning',  label: 'Vence en 15 días',  badgeVariant: 'warning' },
  low:    { row: '',                  badge: 'text-ink-secondary', label: 'Vence en 30 días', badgeVariant: 'muted' }}

function getUrgency(days: number): Urgency {
  if (days <= 7)  return 'high'
  if (days <= 15) return 'medium'
  return 'low'
}

function formatExpiry(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric'})
}

function daysLabel(n: number): string {
  if (n < 0)   return 'Vencida'
  if (n === 0) return 'Hoy'
  if (n === 1) return 'Mañana'
  return `${n}d`
}

function useDebounce<T>(value: T, ms = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return d
}

// ─── Policy row ───────────────────────────────────────────────────────────────
function PolicyRow({
  policy, urgency, onCreateCase, onTriggerRule}: {
  policy: PolicyWithComputed
  urgency: Urgency
  onCreateCase:   (policy: PolicyWithComputed) => void
  onTriggerRule:  (policy: PolicyWithComputed) => void
}) {
  const styles = URGENCY_STYLES[urgency]

  return (
    <tr className={clsx('group', styles.row)}>
      {/* Person */}
      <td>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-surface-muted flex items-center justify-center text-xs font-600 text-ink-secondary shrink-0">
            {policy.person?.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            {policy.person ? (
              <Link
                href={`/personas/${policy.person.id}`}
                className="text-sm font-500 text-ink hover:text-brand transition-colors truncate block max-w-[160px]"
              >
                {policy.person.full_name}
              </Link>
            ) : (
              <span className="text-sm text-ink-tertiary">—</span>
            )}
            {policy.person?.phone && (
              <p className="text-2xs text-ink-tertiary font-mono hidden sm:block">
                {policy.person.phone}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Company */}
      <td className="hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
          <span className="text-sm text-ink-secondary truncate max-w-[130px]">
            {policy.company?.short_name ?? policy.company?.name ?? '—'}
          </span>
        </div>
      </td>

      {/* Ramo */}
      <td className="hidden md:table-cell">
        <span className="text-xs text-ink-secondary uppercase tracking-wide">{policy.ramo}</span>
      </td>

      {/* Producer */}
      <td className="hidden lg:table-cell text-sm text-ink-secondary">
        {policy.producer?.full_name?.split(' ')[0] ?? <span className="text-ink-tertiary">—</span>}
      </td>

      {/* Expiry date */}
      <td>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-secondary">{formatExpiry(policy.end_date)}</span>
        </div>
      </td>

      {/* Days remaining */}
      <td>
        <Badge variant={URGENCY_STYLES[urgency].badgeVariant} className="font-mono font-600 tabular-nums">
          {daysLabel(policy.days_until_expiry)}
        </Badge>
      </td>

      {/* Quick actions */}
      <td>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onCreateCase(policy)}
            title="Crear gestión de renovación"
            className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          {policy.person && (
            <Link
              href={`/conversaciones?search=${encodeURIComponent(policy.person.phone ?? '')}`}
              title="Ver conversaciones de esta persona"
              className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Link>
          )}
          <Link
            href={`/polizas/${policy.id}`}
            title="Ver póliza"
            className="p-1.5 rounded-md text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  )
}

// ─── Skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i}>
          <td className="py-3 px-4 border-b border-surface-border">
            <div className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
          </td>
          <td className="hidden sm:table-cell py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-4 w-24 rounded" />
          </td>
          <td className="hidden md:table-cell py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-4 w-16 rounded" />
          </td>
          <td className="hidden lg:table-cell py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-4 w-20 rounded" />
          </td>
          <td className="py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-4 w-24 rounded" />
          </td>
          <td className="py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-5 w-12 rounded-full" />
          </td>
          <td className="py-3 px-4 border-b border-surface-border">
            <Skeleton className="h-6 w-20 rounded" />
          </td>
        </tr>
      ))}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function VencimientosPage() {
  const [days,          setDays]          = useState(30)
  const [producerId,    setProducerId]    = useState<string | undefined>()
  const [search,        setSearch]        = useState('')
  const [policies,      setPolicies]      = useState<PolicyWithComputed[]>([])
  const [producers,     setProducers]     = useState<ProducerListItem[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [totalCount,    setTotalCount]    = useState(0)
  const [caseTarget,    setCaseTarget]    = useState<PolicyWithComputed | null>(null)

  const handleTriggerRule = useCallback(async (policy: PolicyWithComputed) => {
    setTriggerTarget(policy)
    setResolvedConvId('')
    if (!policy.person) return
    setResolvingConv(true)
    try {
      const res = await getConversations({ person_id: policy.person.id, limit: 1 })
      setResolvedConvId(res.data[0]?.id ?? '')
    } catch {
      setResolvedConvId('')
    } finally {
      setResolvingConv(false)
    }
  }, [])
  const [triggerTarget,  setTriggerTarget]  = useState<PolicyWithComputed | null>(null)
  const [resolvedConvId, setResolvedConvId] = useState<string>('')
  const [resolvingConv,  setResolvingConv]  = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // Load producers for filter dropdown
  useEffect(() => {
    getProducers({ is_active: true })
      .then(res => setProducers(res.data))
      .catch(() => {})
  }, [])

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getExpiringPolicies(days, producerId)
      setPolicies(res.data)
      setTotalCount(res.meta.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar vencimientos')
    } finally {
      setLoading(false)
    }
  }, [days, producerId])

  useEffect(() => { loadPolicies() }, [loadPolicies])

  // Client-side search filter (search is over already-loaded data)
  const filtered = debouncedSearch
    ? policies.filter(p => {
        const q = debouncedSearch.toLowerCase()
        return (
          p.person?.full_name?.toLowerCase().includes(q) ||
          p.company?.name?.toLowerCase().includes(q) ||
          p.company?.short_name?.toLowerCase().includes(q) ||
          p.ramo?.toLowerCase().includes(q) ||
          p.policy_number?.toLowerCase().includes(q)
        )
      })
    : policies

  // Counts for each urgency bucket (applied to full loaded data)
  const count7  = policies.filter(p => p.days_until_expiry >= 0 && p.days_until_expiry <= 7).length
  const count15 = policies.filter(p => p.days_until_expiry >= 0 && p.days_until_expiry <= 15).length
  const count30 = policies.filter(p => p.days_until_expiry >= 0 && p.days_until_expiry <= 30).length

  return (
    <div className="space-y-4 max-w-screen-xl">

      {/* Case creation modal */}
      {triggerTarget && triggerTarget.person && (
        <TriggerRuleModal
          conversationId={resolvedConvId}
          personName={triggerTarget.person.full_name}
          policyId={triggerTarget.id}
          variables={{
            nombre:            triggerTarget.person.full_name,
            fecha_vencimiento: new Date(triggerTarget.end_date).toLocaleDateString('es-AR'),
            dias_para_vencer:  String(triggerTarget.days_until_expiry),
            compania:          triggerTarget.company?.name ?? '',
            ramo:              triggerTarget.ramo}}
          triggerEventFilter={['policy_expiring_7d','policy_expiring_15d','policy_expiring_30d']}
          onClose={() => setTriggerTarget(null)}
        />
      )}

      {caseTarget && (
        <NewCaseModal
          personId={caseTarget.person?.id}
          personName={caseTarget.person?.full_name}
          onClose={() => setCaseTarget(null)}
          onCreated={() => setCaseTarget(null)}
        />
      )}

      {/* ── Header summary cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {DAY_BUCKETS.map(({ days: d, label, urgency }) => {
          const count  = d === 7 ? count7 : d === 15 ? count15 : count30
          const active = days === d
          const sty    = URGENCY_STYLES[urgency]
          return (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'card px-3 py-3 flex flex-col gap-1 transition-all text-left',
                active ? 'ring-2 ring-brand border-brand' : 'hover:border-surface-border-strong'
              )}
            >
              <p className={clsx('text-2xl font-600 tabular-nums', sty.badge)}>
                {loading ? <span className="inline-block w-8 h-7 bg-surface-muted rounded animate-pulse" /> : count}
              </p>
              <p className="text-xs text-ink-secondary font-500">Vencen en {label}</p>
            </button>
          )
        })}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Buscar persona, compañía, ramo…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<Search className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Producer filter */}
        {producers.length > 0 && (
          <select
            value={producerId ?? ''}
            onChange={e => setProducerId(e.target.value || undefined)}
            className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">Todos los productores</option>
            {producers.map(p => (
              <option key={p.id} value={p.id}>{p.user.full_name}</option>
            ))}
          </select>
        )}

        {/* Day filter pills */}
        <div className="flex items-center gap-1.5">
          {DAY_BUCKETS.map(({ days: d, label }) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'px-3 h-9 rounded-lg text-sm font-500 transition-colors',
                days === d
                  ? 'bg-brand text-white'
                  : 'bg-surface border border-surface-border text-ink-secondary hover:bg-surface-subtle'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Result count ─────────────────────────────────────────────────── */}
      {!loading && !error && (
        <p className="text-sm text-ink-secondary">
          {filtered.length > 0
            ? <><span className="font-500 text-ink">{filtered.length}</span> póliza{filtered.length !== 1 ? 's' : ''} por vencer{debouncedSearch ? ` (filtradas de ${totalCount})` : ''}</>
            : debouncedSearch ? `Sin resultados para "${debouncedSearch}"` : 'Sin pólizas por vencer en este período'
          }
        </p>
      )}

      {error && <ErrorAlert message={error} onRetry={loadPolicies} />}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="hidden sm:table-cell">Compañía</th>
                <th className="hidden md:table-cell">Ramo</th>
                <th className="hidden lg:table-cell">Productor</th>
                <th>Fin de vigencia</th>
                <th>Vence en</th>
                <th className="w-24">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? null : (
                filtered.map(policy => (
                  <PolicyRow
                    key={policy.id}
                    policy={policy}
                    urgency={getUrgency(policy.days_until_expiry)}
                    onCreateCase={p => setCaseTarget(p)}
                    onTriggerRule={handleTriggerRule}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length === 0 && !error && (
          <EmptyState
            icon={<AlertTriangle className="w-5 h-5" />}
            title={
              debouncedSearch
                ? 'Sin resultados'
                : `Sin pólizas por vencer en ${days} días`
            }
            description={
              debouncedSearch
                ? `Ninguna póliza coincide con "${debouncedSearch}".`
                : `No hay pólizas activas con vencimiento en los próximos ${days} días.`
            }
          />
        )}
      </div>
    </div>
  )
}
