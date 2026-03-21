'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Zap, FileText, Clock, History, Plus, ToggleLeft, ToggleRight,
  Edit2, RefreshCw, AlertCircle, CheckCircle2} from 'lucide-react'
import { clsx } from 'clsx'
import {
  useTemplates, useRules, useScheduledMessages, useAutomationHistory,
  useTemplateActions, useRuleActions, useScheduledActions} from '@/hooks/useAutomations'
import { cancelScheduledMessageWithReason } from '@/lib/api/automations'
import { TemplateForm } from '@/components/domain/automations/TemplateForm'
import { RuleForm } from '@/components/domain/automations/RuleForm'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/shared/Pagination'
import { TRIGGER_EVENT_LABELS } from '@adding/types'
import type { Template, RuleDetail, AutomationHistoryEntry } from '@/lib/api/automations'

type Tab = 'reglas' | 'templates' | 'programados' | 'historial'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ScheduledStatusBadge({ status }: { status: string }) {
  const MAP: Record<string, { label: string; variant: 'success'|'warning'|'danger'|'muted'|'info'|'default' }> = {
    pending:    { label: 'Pendiente',   variant: 'warning' },
    processing: { label: 'Procesando', variant: 'info'    },
    sent:       { label: 'Enviado',     variant: 'success' },
    cancelled:  { label: 'Cancelado',  variant: 'muted'   },
    failed:     { label: 'Fallido',     variant: 'danger'  },
    overridden: { label: 'Anulado',    variant: 'muted'   }}
  const cfg = MAP[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs   = d.getTime() - now.getTime()
  const pastMs   = now.getTime() - d.getTime()
  const isPast   = diffMs < 0
  const absMins  = Math.floor(Math.abs(diffMs) / 60_000)
  const absHours = Math.floor(absMins / 60)
  const absDays  = Math.floor(absHours / 24)

  if (absMins < 1)   return isPast ? 'hace un momento' : 'ahora'
  if (absMins < 60)  return isPast ? `hace ${absMins}m`  : `en ${absMins}m`
  if (absHours < 24) return isPast ? `hace ${absHours}h` : `en ${absHours}h`
  if (absDays < 7)   return isPast ? `hace ${absDays}d`  : `en ${absDays}d`
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})
}

// ─── History action labels ────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; variant: 'success'|'info'|'muted'|'danger' }> = {
  scheduled_message_sent:  { label: 'Mensaje enviado',     variant: 'success' },
  rule_triggered_manually: { label: 'Disparo manual',      variant: 'info'    },
  scheduled_message_failed:{ label: 'Envío fallido',        variant: 'danger'  },
  rule_fired_for_event:    { label: 'Disparo automático',  variant: 'info'    }}

// ─── Cancel confirm dialog ────────────────────────────────────────────────────
function CancelDialog({
  onConfirm, onCancel, acting}: { onConfirm: (reason: string) => void; onCancel: () => void; acting: boolean }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface rounded-xl w-full max-w-sm shadow-dropdown animate-fade-in p-4 space-y-3">
        <p className="text-sm font-600 text-ink">Cancelar mensaje programado</p>
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Motivo (opcional)…"
          className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="danger" size="sm" loading={acting}
            onClick={() => onConfirm(reason || 'Cancelado manualmente')} className="flex-1">
            Cancelar mensaje
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>Volver</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Templates tab ────────────────────────────────────────────────────────────
function TemplatesTab() {
  const { data, loading, error, refetch } = useTemplates()
  const { save, acting, error: actionError, clearError } = useTemplateActions(refetch)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Template | null>(null)
  const [search, setSearch]     = useState('')

  const filtered = search
    ? data.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : data

  if (loading) return <div className="space-y-2">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-16 rounded" />)}</div>
  if (error)   return <ErrorAlert message={error} onRetry={refetch} />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text" placeholder="Buscar template…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => { setEditing(null); setShowForm(true) }}>
          Nuevo template
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<FileText className="w-5 h-5" />}
          title={search ? 'Sin resultados' : 'Sin templates'}
          description={search ? undefined : 'Creá tu primer template de mensaje automático.'} />
      ) : (
        <div className="card divide-y divide-surface-border">
          {filtered.map(t => (
            <div key={t.id} className={clsx('flex items-start gap-3 px-4 py-3', !t.is_active && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-500 text-ink">{t.name}</p>
                  <Badge variant="muted" className="text-2xs capitalize">{t.type}</Badge>
                  {t.channel !== 'whatsapp' && <Badge variant="info" className="text-2xs">{t.channel}</Badge>}
                  {!t.is_active && <Badge variant="muted" className="text-2xs">Inactivo</Badge>}
                </div>
                {/* Template body preview */}
                <p className="text-xs text-ink-secondary font-mono mt-1 line-clamp-2 bg-surface-subtle rounded px-2 py-1">
                  {t.body.slice(0, 120)}{t.body.length > 120 ? '…' : ''}
                </p>
                {t.variables.length > 0 && (
                  <p className="text-2xs text-brand mt-1">
                    {t.variables.map(v => `{{${v}}}`).join(' · ')}
                  </p>
                )}
              </div>
              <button onClick={() => { setEditing(t); setShowForm(true) }}
                className="p-1.5 rounded text-ink-tertiary hover:text-ink hover:bg-surface-muted transition-colors shrink-0">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TemplateForm
          templateId={editing?.id}
          initial={editing ?? undefined}
          onSave={async (data, id) => { const ok = await save(data, id); if (ok) setShowForm(false) }}
          onClose={() => { setShowForm(false); clearError() }}
          acting={acting}
          error={actionError}
        />
      )}
    </div>
  )
}

// ─── Rules tab ────────────────────────────────────────────────────────────────
function RulesTab() {
  const { data: rules,     loading,    error,       refetch }       = useRules()
  const { data: templates, loading: tl }                             = useTemplates()
  const { save, toggle, acting, error: actionError, clearError }     = useRuleActions(refetch)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<RuleDetail | null>(null)
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)

  const filtered = filterActive !== undefined
    ? (rules ?? []).filter(r => r.is_active === filterActive)
    : (rules ?? [])

  if (loading || tl) return <div className="space-y-2">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-18 rounded" />)}</div>
  if (error)         return <ErrorAlert message={error} onRetry={refetch} />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Active filter pills */}
        <div className="flex gap-1.5">
          {[
            { value: undefined,  label: 'Todas' },
            { value: true,       label: 'Activas' },
            { value: false,      label: 'Inactivas' },
          ].map(({ value, label }) => (
            <button key={label} onClick={() => setFilterActive(value)}
              className={clsx('px-2.5 h-7 rounded-full text-xs font-500 transition-colors',
                filterActive === value ? 'bg-brand text-white' : 'bg-surface-muted text-ink-secondary hover:bg-surface-border'
              )}>
              {label}
            </button>
          ))}
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => { setEditing(null); setShowForm(true) }} className="ml-auto">
          Nueva regla
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Zap className="w-5 h-5" />}
          title="Sin reglas"
          description="Creá una regla para automatizar mensajes." />
      ) : (
        <div className="card divide-y divide-surface-border">
          {filtered.map(rule => (
            <div key={rule.id} className={clsx('flex items-start gap-3 px-4 py-3', !rule.is_active && 'opacity-55')}>
              {/* Toggle */}
              <button onClick={() => toggle(rule.id, rule.is_active)} disabled={acting}
                className="mt-0.5 shrink-0" title={rule.is_active ? 'Desactivar' : 'Activar'}>
                {rule.is_active
                  ? <ToggleRight className="w-5 h-5 text-brand" />
                  : <ToggleLeft className="w-5 h-5 text-ink-tertiary" />
                }
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-500 text-ink">{rule.name}</p>
                  <Badge variant="info" className="text-2xs">
                    {TRIGGER_EVENT_LABELS[rule.trigger_event as keyof typeof TRIGGER_EVENT_LABELS] ?? rule.trigger_event}
                  </Badge>
                </div>

                {/* Rule details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-1.5">
                  {rule.template && (
                    <p className="text-xs text-ink-secondary flex items-center gap-1">
                      <FileText className="w-3 h-3 text-ink-tertiary" />
                      {rule.template.name}
                    </p>
                  )}
                  {rule.delay_hours > 0 && (
                    <p className="text-xs text-ink-tertiary flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {rule.delay_hours}h de demora
                    </p>
                  )}
                  {rule.recurrence_days && (
                    <p className="text-xs text-ink-tertiary">🔁 Repite cada {rule.recurrence_days} días</p>
                  )}
                  {rule.filter_ramo && (
                    <p className="text-xs text-ink-tertiary">🏷 Sólo ramo: <span className="font-500">{rule.filter_ramo}</span></p>
                  )}
                  {rule.cancel_on_events.length > 0 && (
                    <p className="text-xs text-ink-tertiary col-span-2">
                      ✕ Cancela si: {rule.cancel_on_events.join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Edit */}
              <button onClick={() => { setEditing(rule); setShowForm(true) }}
                className="p-1.5 rounded text-ink-tertiary hover:text-ink hover:bg-surface-muted shrink-0">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <RuleForm
          ruleId={editing?.id}
          initial={editing ?? undefined}
          templates={templates ?? []}
          onSave={async (data, id) => { const ok = await save(data, id); if (ok) setShowForm(false) }}
          onClose={() => { setShowForm(false); clearError() }}
          acting={acting}
          error={actionError}
        />
      )}
    </div>
  )
}

// ─── Scheduled tab ────────────────────────────────────────────────────────────
function ScheduledTab() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending')
  const [page, setPage]                 = useState(1)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelling, setCancelling]     = useState(false)

  const { data, loading, error, refetch } = useScheduledMessages({
    status: statusFilter, page, limit: 20})

  const handleCancel = async (id: string, reason: string) => {
    setCancelling(true)
    try {
      await cancelScheduledMessageWithReason(id, reason)
      setCancelTarget(null)
      refetch()
    } catch {} finally { setCancelling(false) }
  }

  const STATUS_FILTERS = [
    { value: undefined,   label: 'Todos'      },
    { value: 'pending',   label: 'Pendientes' },
    { value: 'sent',      label: 'Enviados'   },
    { value: 'failed',    label: 'Fallidos'   },
    { value: 'cancelled', label: 'Cancelados' },
  ] as const

  return (
    <div className="space-y-3">
      {cancelTarget && (
        <CancelDialog
          onConfirm={reason => handleCancel(cancelTarget, reason)}
          onCancel={() => setCancelTarget(null)}
          acting={cancelling}
        />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button key={label} onClick={() => { setStatusFilter(value); setPage(1) }}
              className={clsx('px-2.5 h-7 rounded-full text-xs font-500 transition-colors',
                statusFilter === value ? 'bg-brand text-white' : 'bg-surface-muted text-ink-secondary hover:bg-surface-border'
              )}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={refetch} className="ml-auto p-1.5 rounded text-ink-tertiary hover:text-ink" title="Actualizar">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
        ) : (data?.data.length ?? 0) === 0 ? (
          <EmptyState icon={<Clock className="w-5 h-5" />}
            title={statusFilter === 'pending' ? 'No hay mensajes pendientes' : 'Sin mensajes en esta vista'} />
        ) : (
          <div className="divide-y divide-surface-border">
            {data!.data.map(msg => (
              <div key={msg.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-mono text-ink">{msg.conversation?.wa_phone ?? '—'}</p>
                    {msg.conversation?.wa_contact_name && (
                      <span className="text-xs text-ink-tertiary">({msg.conversation.wa_contact_name})</span>
                    )}
                    <ScheduledStatusBadge status={msg.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-tertiary flex-wrap">
                    {msg.template && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {msg.template.name}</span>}
                    {msg.rule && <span>· {msg.rule.name}</span>}
                    {msg.attempts > 0 && <span>{msg.attempts}/{msg.max_attempts} intentos</span>}
                  </div>
                  {msg.last_error && (
                    <p className="text-xs text-danger mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {msg.last_error.slice(0, 80)}
                    </p>
                  )}
                  {msg.cancel_reason && (
                    <p className="text-xs text-ink-tertiary mt-0.5">Motivo: {msg.cancel_reason}</p>
                  )}
                  {/* Context links */}
                  <div className="flex items-center gap-2 mt-1">
                    {msg.case_id && (
                      <Link href={`/gestiones/${msg.case_id}`}
                        className="text-2xs text-brand hover:underline">Ver caso</Link>
                    )}
                    {msg.policy_id && (
                      <Link href={`/polizas/${msg.policy_id}`}
                        className="text-2xs text-brand hover:underline">Ver póliza</Link>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-xs text-ink-secondary">{formatRelative(msg.scheduled_for)}</p>
                  <p className="text-2xs text-ink-tertiary">{formatDateTime(msg.scheduled_for)}</p>
                  {msg.status === 'pending' && (
                    <button onClick={() => setCancelTarget(msg.id)}
                      className="text-2xs text-danger hover:underline block">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
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

// ─── History tab ──────────────────────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage]         = useState(1)
  const [actionFilter, setActionFilter] = useState<string | undefined>()
  const { data, loading, error, refetch } = useAutomationHistory({ page, limit: 30, action: actionFilter })

  const ACTION_FILTERS = [
    { value: undefined,                 label: 'Todos'          },
    { value: 'scheduled_message_sent',  label: 'Enviados'       },
    { value: 'rule_triggered_manually', label: 'Manuales'       },
    { value: 'scheduled_message_failed',label: 'Fallidos'       },
  ] as const

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1.5">
          {ACTION_FILTERS.map(({ value, label }) => (
            <button key={label} onClick={() => { setActionFilter(value); setPage(1) }}
              className={clsx('px-2.5 h-7 rounded-full text-xs font-500 transition-colors',
                actionFilter === value ? 'bg-brand text-white' : 'bg-surface-muted text-ink-secondary hover:bg-surface-border'
              )}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={refetch} className="ml-auto p-1.5 rounded text-ink-tertiary hover:text-ink">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={refetch} />}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">{Array.from({length:5}).map((_,i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
        ) : (data?.data.length ?? 0) === 0 ? (
          <EmptyState icon={<History className="w-5 h-5" />}
            title="Sin historial" description="Las ejecuciones de reglas aparecerán aquí." />
        ) : (
          <div className="divide-y divide-surface-border">
            {data!.data.map(entry => {
              const cfg = ACTION_LABELS[entry.action] ?? { label: entry.action, variant: 'muted' as const }
              const isManual = entry.payload.is_manual === true
              return (
                <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                  {/* Icon */}
                  <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    cfg.variant === 'success' ? 'bg-success-bg' :
                    cfg.variant === 'danger'  ? 'bg-danger-bg'  : 'bg-info-bg'
                  )}>
                    {cfg.variant === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> :
                     cfg.variant === 'danger'  ? <AlertCircle className="w-3.5 h-3.5 text-danger" /> :
                     <Zap className="w-3.5 h-3.5 text-info" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {isManual
                        ? <span className="text-2xs text-ink-tertiary bg-surface-muted px-1.5 py-0.5 rounded-full">Manual</span>
                        : <span className="text-2xs text-ink-tertiary bg-surface-muted px-1.5 py-0.5 rounded-full">Auto</span>
                      }
                    </div>
                    {entry.payload.notes && (
                      <p className="text-xs text-ink-secondary mt-0.5 truncate max-w-[400px]">
                        {entry.payload.notes as string}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {entry.conversation_id && (
                        <Link href={`/conversaciones/${entry.conversation_id}`}
                          className="text-2xs text-brand hover:underline">Ver conversación</Link>
                      )}
                      {entry.case_id && (
                        <Link href={`/gestiones/${entry.case_id}`}
                          className="text-2xs text-brand hover:underline">Ver caso</Link>
                      )}
                    </div>
                  </div>

                  <p className="text-2xs text-ink-tertiary shrink-0" title={entry.created_at}>
                    {formatRelative(entry.created_at)}
                  </p>
                </div>
              )
            })}
          </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AutomatizacionesPage() {
  const [tab, setTab] = useState<Tab>('reglas')
  const { data: rules } = useRules()

  const activeCount   = (rules ?? []).filter(r => r.is_active).length
  const inactiveCount = (rules ?? []).filter(r => !r.is_active).length

  const TABS = [
    { id: 'reglas'      as Tab, label: 'Reglas',       icon: Zap,      badge: activeCount > 0 ? String(activeCount) : undefined },
    { id: 'templates'   as Tab, label: 'Templates',    icon: FileText, badge: undefined },
    { id: 'programados' as Tab, label: 'Programados',  icon: Clock,    badge: undefined },
    { id: 'historial'   as Tab, label: 'Historial',    icon: History,  badge: undefined },
  ]

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Tab nav */}
      <div className="flex gap-0.5 bg-surface-muted p-1 rounded-lg w-fit overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-500 transition-colors whitespace-nowrap',
              tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-secondary hover:text-ink'
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
            {badge && (
              <span className="ml-0.5 text-2xs bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-600">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'reglas'      && <RulesTab />}
      {tab === 'templates'   && <TemplatesTab />}
      {tab === 'programados' && <ScheduledTab />}
      {tab === 'historial'   && <HistoryTab />}
    </div>
  )
}
