'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  MessageSquare, FolderOpen, Shield, Clock,
  FileText, AlertTriangle, RefreshCw, User,
  ChevronRight, Zap, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getMyDay } from '@/lib/api/dashboard'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Badge } from '@/components/ui/Badge'
import { CasePriorityBadge } from '@/components/domain/cases/CasePriorityBadge'
import { TriggerRuleModal } from '@/components/domain/automations/TriggerRuleModal'
import type {
  MyDayData, UnreadConversation, OverdueCase,
  ExpiringPolicy, ScheduledToday, PendingQuote, FailedMessage,
} from '@/lib/api/dashboard'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1)  return 'ahora'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  return `${d}d`
}

function scheduledTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

// ─── Summary bar ─────────────────────────────────────────────────────────────
interface SummaryBarProps {
  summary: MyDayData['summary']
  loading: boolean
}

function SummaryBar({ summary, loading }: SummaryBarProps) {
  const ITEMS = [
    { key: 'unread_conversations', label: 'Sin leer',    icon: MessageSquare, color: 'text-brand',   urgent: summary.unread_conversations > 0 },
    { key: 'overdue_cases',        label: 'Vencidos',    icon: FolderOpen,    color: 'text-danger',  urgent: summary.overdue_cases > 0 },
    { key: 'expiring_policies',    label: 'Por vencer',  icon: Shield,        color: 'text-warning', urgent: summary.expiring_policies > 0 },
    { key: 'scheduled_today',      label: 'Hoy',         icon: Clock,         color: 'text-info',    urgent: false },
    { key: 'pending_quotes',       label: 'En espera',   icon: FileText,      color: 'text-ink-secondary', urgent: summary.pending_quotes > 0 },
    { key: 'failed_messages',      label: 'Fallidos',    icon: AlertTriangle, color: 'text-danger',  urgent: summary.failed_messages > 0 },
  ] as const

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {ITEMS.map(({ key, label, icon: Icon, color, urgent }) => (
        <div key={key} className={clsx(
          'card px-3 py-3 flex flex-col items-center gap-1 text-center',
          urgent && 'border-current/20 bg-current/5'
        )}>
          <Icon className={clsx('w-4 h-4', color)} />
          {loading
            ? <Skeleton className="h-6 w-8 rounded" />
            : <p className={clsx('text-xl font-600 tabular-nums', color)}>{summary[key]}</p>
          }
          <p className="text-2xs text-ink-tertiary leading-tight">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, count, accentColor = 'text-ink-secondary',
  loading, empty, children, viewAllHref,
}: {
  title: string; icon: React.ElementType; count: number
  accentColor?: string; loading: boolean
  empty: string; children: React.ReactNode; viewAllHref?: string
}) {
  if (!loading && count === 0) return null

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <Icon className={clsx('w-4 h-4', accentColor)} />
          <h2 className="text-sm font-600 text-ink">{title}</h2>
          {!loading && (
            <span className={clsx('text-2xs font-600 px-1.5 py-0.5 rounded-full tabular-nums',
              count > 0 ? `${accentColor} bg-current/10` : 'text-ink-tertiary bg-surface-muted'
            )}>
              {count}
            </span>
          )}
        </div>
        {viewAllHref && count > 0 && (
          <Link href={viewAllHref} className="text-xs text-brand hover:underline">Ver todos</Link>
        )}
      </div>

      {loading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
        </div>
      ) : count === 0 ? (
        <p className="px-4 py-4 text-sm text-ink-tertiary">{empty}</p>
      ) : children}
    </section>
  )
}

// ─── Unread conversations ─────────────────────────────────────────────────────
function UnreadConversations({ items }: { items: UnreadConversation[] }) {
  return (
    <div className="divide-y divide-surface-border">
      {items.map(c => (
        <Link key={c.id} href={`/conversaciones/${c.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors group">
          <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-600 text-brand">
              {(c.person_name ?? c.wa_contact_name ?? c.wa_phone)[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-500 text-ink truncate">
                {c.person_name ?? c.wa_contact_name ?? c.wa_phone}
              </p>
              <span className="w-5 h-5 rounded-full bg-brand text-white text-2xs flex items-center justify-center font-600 shrink-0">
                {c.unread_count > 9 ? '9+' : c.unread_count}
              </span>
            </div>
            {c.last_message_text && (
              <p className="text-xs text-ink-secondary truncate">{c.last_message_text}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {c.last_message_at && (
              <span className="text-2xs text-ink-tertiary">{relativeTime(c.last_message_at)}</span>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Overdue cases ────────────────────────────────────────────────────────────
function OverdueCases({ items }: { items: OverdueCase[] }) {
  return (
    <div className="divide-y divide-surface-border">
      {items.map(c => (
        <Link key={c.id} href={`/gestiones/${c.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-500 text-ink truncate">{c.title}</p>
              <CasePriorityBadge priority={c.priority} compact />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-tertiary">
              {c.person_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{c.person_name}</span>}
              {c.assigned_to_name && <span>→ {c.assigned_to_name.split(' ')[0]}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-danger font-600 tabular-nums">
              +{c.days_overdue}d
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Expiring policies ────────────────────────────────────────────────────────
function ExpiringPolicies({ items }: { items: ExpiringPolicy[] }) {
  const [triggerTarget, setTriggerTarget] = useState<ExpiringPolicy | null>(null)

  return (
    <>
      {triggerTarget && triggerTarget.person_phone && (
        <TriggerRuleModal
          conversationId=""
          personName={triggerTarget.person_name}
          policyId={triggerTarget.id}
          variables={{
            nombre:            triggerTarget.person_name ?? '',
            compania:          triggerTarget.company_name ?? '',
            ramo:              triggerTarget.ramo,
            fecha_vencimiento: formatDate(triggerTarget.end_date),
            dias_para_vencer:  String(triggerTarget.days_until_expiry),
          }}
          triggerEventFilter={['policy_expiring_7d', 'policy_expiring_15d', 'policy_expiring_30d']}
          onClose={() => setTriggerTarget(null)}
        />
      )}

      <div className="divide-y divide-surface-border">
        {items.map(p => {
          const urgency = p.days_until_expiry <= 7 ? 'danger' : p.days_until_expiry <= 15 ? 'warning' : 'muted'
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-500 text-ink">{p.person_name ?? '—'}</p>
                  <Badge variant={urgency} className="font-mono text-2xs font-600">
                    {p.days_until_expiry}d
                  </Badge>
                  {p.renewal_status === 'renewed' && (
                    <Badge variant="success" className="text-2xs">Renovada</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-tertiary">
                  {p.company_name} · {p.ramo} · {formatDate(p.end_date)}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setTriggerTarget(p)}
                  title="Enviar recordatorio"
                  className="p-1.5 rounded text-ink-tertiary hover:text-brand hover:bg-brand/10 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                </button>
                <Link href={`/polizas/${p.id}`}
                  className="p-1.5 rounded text-ink-tertiary hover:text-ink hover:bg-surface-muted transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ─── Scheduled today ──────────────────────────────────────────────────────────
function ScheduledToday({ items }: { items: ScheduledToday[] }) {
  const pending = items.filter(m => m.status === 'pending')
  const sent    = items.filter(m => m.status === 'sent')
  const failed  = items.filter(m => m.status === 'failed')

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'sent')    return <CheckCircle2 className="w-3.5 h-3.5 text-success" />
    if (status === 'failed')  return <AlertCircle className="w-3.5 h-3.5 text-danger" />
    return <Clock className="w-3.5 h-3.5 text-warning" />
  }

  return (
    <div className="divide-y divide-surface-border">
      {/* Summary counts */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-surface-subtle text-xs text-ink-secondary">
        {pending.length > 0 && <span className="flex items-center gap-1 text-warning"><Clock className="w-3 h-3" />{pending.length} pendientes</span>}
        {sent.length    > 0 && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-3 h-3" />{sent.length} enviados</span>}
        {failed.length  > 0 && <span className="flex items-center gap-1 text-danger"><AlertCircle className="w-3 h-3" />{failed.length} fallidos</span>}
      </div>
      {items.map(m => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
          <StatusIcon status={m.status} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink truncate">{m.template_name ?? 'Mensaje'}</p>
            <div className="flex items-center gap-2 text-xs text-ink-tertiary">
              <span className="font-mono">{m.wa_phone}</span>
              {m.rule_name && <span>· {m.rule_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-ink-tertiary">{scheduledTime(m.scheduled_for)}</span>
            {(m.case_id || m.policy_id) && (
              <Link
                href={m.case_id ? `/gestiones/${m.case_id}` : `/polizas/${m.policy_id}`}
                className="text-2xs text-brand hover:underline"
              >
                {m.case_id ? 'Caso' : 'Póliza'}
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Pending quotes ───────────────────────────────────────────────────────────
function PendingQuotes({ items }: { items: PendingQuote[] }) {
  return (
    <div className="divide-y divide-surface-border">
      {items.map(q => (
        <Link key={q.id} href={`/cotizaciones/${q.id}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors group">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-500 text-ink">{q.person_name ?? '—'}</p>
            <div className="flex items-center gap-2 text-xs text-ink-tertiary">
              <span>{q.option_count} opción{q.option_count !== 1 ? 'es' : ''}</span>
              {q.producer_name && <span>· {q.producer_name.split(' ')[0]}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={clsx('text-xs font-600 tabular-nums',
              q.days_waiting > 7 ? 'text-danger' : q.days_waiting > 3 ? 'text-warning' : 'text-ink-secondary'
            )}>
              {q.days_waiting}d sin resp.
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Failed messages (errors queue) ──────────────────────────────────────────
function FailedMessages({ items }: { items: FailedMessage[] }) {
  return (
    <div className="divide-y divide-surface-border">
      {items.map(m => (
        <div key={m.id} className="flex items-start gap-3 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-500 text-ink">{m.template_name ?? 'Mensaje'}</p>
              <span className="text-2xs bg-danger-bg text-danger px-1.5 py-0.5 rounded-full">
                {m.attempts} intentos
              </span>
            </div>
            {m.last_error && (
              <p className="text-xs text-danger mt-0.5 line-clamp-1">{m.last_error}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-tertiary">
              {m.wa_phone && <span className="font-mono">{m.wa_phone}</span>}
              {m.rule_name && <span>· {m.rule_name}</span>}
              <span>· {formatDate(m.scheduled_for)}</span>
            </div>
          </div>
          <Link href="/automatizaciones?tab=programados&status=failed"
            className="text-2xs text-brand hover:underline shrink-0">
            Ver cola
          </Link>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MiDiaPage() {
  const [data, setData]         = useState<MyDayData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [assignedToMe, setAssigned] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getMyDay(assignedToMe)
      setData(res.data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [assignedToMe])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const id = setInterval(load, 2 * 60_000)
    return () => clearInterval(id)
  }, [load])

  const summary = data?.summary ?? {
    unread_conversations: 0, overdue_cases: 0, expiring_policies: 0,
    scheduled_today: 0, pending_quotes: 0, failed_messages: 0,
  }

  const totalAlerts = summary.unread_conversations + summary.overdue_cases +
    summary.failed_messages

  return (
    <div className="space-y-4 max-w-3xl animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-600 text-ink">
            Mi día
            {!loading && totalAlerts > 0 && (
              <span className="ml-2 text-sm font-500 text-danger">
                · {totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {lastRefresh.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · se actualiza automáticamente
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* My items only toggle */}
          <button
            onClick={() => setAssigned(a => !a)}
            className={clsx(
              'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-500 border transition-colors',
              assignedToMe
                ? 'bg-brand text-white border-brand'
                : 'bg-surface border-surface-border text-ink-secondary hover:bg-surface-subtle'
            )}
          >
            <User className="w-3.5 h-3.5" />
            {assignedToMe ? 'Solo lo mío' : 'Todo el equipo'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={clsx('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={load} />}

      {/* Summary bar */}
      <SummaryBar summary={summary} loading={loading} />

      {/* All-clear state — only when nothing is loading and everything is empty */}
      {!loading && !error && totalAlerts === 0 &&
       summary.expiring_policies === 0 && summary.pending_quotes === 0 &&
       summary.scheduled_today === 0 && (
        <div className="card px-6 py-12 flex flex-col items-center gap-4 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-success-bg flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <div>
            <p className="text-base font-600 text-ink">Todo al día</p>
            <p className="text-sm text-ink-secondary mt-1 max-w-xs">
              Sin conversaciones pendientes, gestiones vencidas ni alertas activas.
            </p>
          </div>
          <div className="flex gap-3 mt-2 flex-wrap justify-center">
            <Link href="/conversaciones"
              className="text-sm text-brand hover:underline flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" /> Ver conversaciones
            </Link>
            <Link href="/gestiones"
              className="text-sm text-ink-secondary hover:text-ink hover:underline flex items-center gap-1">
              <FolderOpen className="w-3.5 h-3.5" /> Ver gestiones
            </Link>
            <Link href="/polizas/vencimientos"
              className="text-sm text-ink-secondary hover:text-ink hover:underline flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Ver vencimientos
            </Link>
          </div>
        </div>
      )}

      {/* Sections — only render if count > 0 or loading */}

      <Section title="Conversaciones sin leer" icon={MessageSquare} accentColor="text-brand"
        count={summary.unread_conversations} loading={loading}
        empty="Sin conversaciones pendientes de leer."
        viewAllHref="/conversaciones?unread_only=true">
        {data && <UnreadConversations items={data.unread_conversations} />}
      </Section>

      <Section title="Errores de automatización" icon={AlertTriangle} accentColor="text-danger"
        count={summary.failed_messages} loading={loading}
        empty="Sin errores recientes."
        viewAllHref="/automatizaciones?tab=programados&status=failed">
        {data && <FailedMessages items={data.failed_messages} />}
      </Section>

      <Section title="Gestiones vencidas" icon={FolderOpen} accentColor="text-danger"
        count={summary.overdue_cases} loading={loading}
        empty="Sin gestiones vencidas."
        viewAllHref="/gestiones?overdue_only=true">
        {data && <OverdueCases items={data.overdue_cases} />}
      </Section>

      <Section title="Pólizas por vencer (15 días)" icon={Shield} accentColor="text-warning"
        count={summary.expiring_policies} loading={loading}
        empty="Sin pólizas próximas a vencer."
        viewAllHref="/polizas/vencimientos">
        {data && <ExpiringPolicies items={data.expiring_policies} />}
      </Section>

      <Section title="Cotizaciones en espera" icon={FileText} accentColor="text-ink-secondary"
        count={summary.pending_quotes} loading={loading}
        empty="Sin cotizaciones esperando respuesta."
        viewAllHref="/cotizaciones?status=sent_to_client">
        {data && <PendingQuotes items={data.pending_quotes} />}
      </Section>

      <Section title="Mensajes programados para hoy" icon={Clock} accentColor="text-info"
        count={summary.scheduled_today} loading={loading}
        empty="Sin mensajes programados para hoy."
        viewAllHref="/automatizaciones?tab=programados">
        {data && <ScheduledToday items={data.scheduled_today} />}
      </Section>

    </div>
  )
}
