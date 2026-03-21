'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, User, Shield, Send, CheckCircle2,
  Lightbulb, ChevronDown, ChevronUp, Edit2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { formatCurrency } from '@adding/utils'
import { useQuoteDetail, useQuoteActions } from '@/hooks/useQuotes'
import { useToast } from '@/components/ui/Toast'
import { QuoteStatusBadge } from '@/components/domain/quotes/QuoteStatusBadge'
import { QuoteOptionCard } from '@/components/domain/quotes/QuoteOptionCard'
import { Button } from '@/components/ui/Button'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { EmptyState } from '@/components/ui/EmptyState'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'

const RISK_TYPE_LABELS: Record<string, string> = {
  auto: 'Auto', moto: 'Moto', hogar: 'Hogar', vida: 'Vida',
  accidentes: 'Accidentes', comercial: 'Comercial',
  transporte: 'Transporte', responsabilidad: 'Resp. Civil', otros: 'Otros',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Recommendation box ───────────────────────────────────────────────────────
function RecommendationBox({
  text, onSave, acting,
}: { text: string | null; onSave: (t: string) => void; acting: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(text ?? '')

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="Ej: Recomiendo Federación Patronal plan Todo Riesgo por mejor relación precio/cobertura"
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="primary" size="xs" loading={acting}
            onClick={() => { onSave(draft); setEditing(false) }}>
            Guardar
          </Button>
          <Button variant="ghost" size="xs" onClick={() => { setDraft(text ?? ''); setEditing(false) }}>
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group cursor-pointer rounded-lg border border-dashed border-success/40 bg-success-bg/50 px-3 py-2.5 hover:border-success/70 transition-colors"
    >
      {text ? (
        <div className="flex items-start gap-2">
          <p className="text-sm text-ink flex-1">{text}</p>
          <Edit2 className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 transition-opacity" />
        </div>
      ) : (
        <p className="text-sm text-ink-tertiary italic flex items-center gap-1.5">
          <Edit2 className="w-3.5 h-3.5" /> Agregar recomendación interna…
        </p>
      )}
    </div>
  )
}

// ─── Options section ──────────────────────────────────────────────────────────
function OptionsSection({
  title, badge, defaultOpen = true, empty, children,
}: {
  title: string; badge?: React.ReactNode; defaultOpen?: boolean
  empty?: string; children?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-surface-border hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-600 text-ink">{title}</h2>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
      </button>
      {open && (
        children ?? (
          <div className="px-4 py-4 text-sm text-ink-tertiary italic">{empty}</div>
        )
      )}
    </section>
  )
}

// ─── Mark sent dialog ─────────────────────────────────────────────────────────
function MarkSentDialog({
  options, onConfirm, onCancel, acting,
}: {
  options: { id: string; company_name: string; plan_name: string; is_sent_to_client: boolean }[]
  onConfirm: (ids: string[]) => void
  onCancel: () => void
  acting: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(options.filter(o => o.is_sent_to_client).map(o => o.id))
  )

  const toggle = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface rounded-xl w-full max-w-md shadow-dropdown animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <h3 className="text-sm font-600">Marcar como enviada al cliente</h3>
          <button onClick={onCancel} className="text-ink-tertiary hover:text-ink text-lg">×</button>
        </div>
        <div className="p-4 space-y-2">
          <p className="text-xs text-ink-tertiary mb-3">Seleccioná qué opciones incluir en el envío:</p>
          {options.map(o => (
            <label key={o.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-subtle cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(o.id)}
                onChange={() => toggle(o.id)}
                className="w-4 h-4 accent-brand"
              />
              <div>
                <p className="text-sm font-500">{o.company_name}</p>
                <p className="text-xs text-ink-tertiary">{o.plan_name}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="primary" size="md" loading={acting}
            disabled={selected.size === 0}
            onClick={() => onConfirm([...selected])}
            className="flex-1">
            Confirmar envío ({selected.size})
          </Button>
          <Button variant="secondary" size="md" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Select option dialog ─────────────────────────────────────────────────────
function SelectOptionDialog({
  options, onConfirm, onCancel, acting,
}: {
  options: { id: string; company_name: string; plan_name: string; premium: number; currency: string }[]
  onConfirm: (id: string, reason: string) => void
  onCancel: () => void
  acting: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [reason,   setReason]   = useState('')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface rounded-xl w-full max-w-md shadow-dropdown animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <h3 className="text-sm font-600">El cliente eligió una opción</h3>
          <button onClick={onCancel} className="text-ink-tertiary hover:text-ink text-lg">×</button>
        </div>
        <div className="p-4 space-y-2">
          {options.map(o => (
            <label key={o.id} className={clsx(
              'flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition-colors',
              selected === o.id ? 'border-brand bg-brand/5' : 'border-surface-border hover:bg-surface-subtle'
            )}>
              <input type="radio" name="option" value={o.id}
                checked={selected === o.id}
                onChange={() => setSelected(o.id)}
                className="accent-brand" />
              <div className="flex-1">
                <p className="text-sm font-500">{o.company_name}</p>
                <p className="text-xs text-ink-tertiary">{o.plan_name}</p>
              </div>
              <p className="text-sm font-600 text-ink tabular-nums">
                {formatCurrency(o.premium, o.currency)}
              </p>
            </label>
          ))}
          <div className="pt-2">
            <label className="text-xs font-500 text-ink-secondary block mb-1">
              Motivo de elección (opcional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej: Mejor precio, cobertura completa…"
              className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="primary" size="md" loading={acting}
            disabled={!selected}
            onClick={() => selected && onConfirm(selected, reason)}
            className="flex-1">
            Confirmar elección
          </Button>
          <Button variant="secondary" size="md" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CotizacionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: quote, loading, error, refetch } = useQuoteDetail(id)
  const { success: toastSuccess, error: toastError } = useToast()
  const { markSent, selectOption, toggleSentToClient, removeOption, updateRecommendation, acting, error: actionError, clearError } =
    useQuoteActions(id, refetch)

  const [showMarkSent,   setShowMarkSent]   = useState(false)
  const [showSelectOpt,  setShowSelectOpt]  = useState(false)
  const [showNewCase,    setShowNewCase]     = useState(false)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-48" />
      </div>
      <CardSkeleton rows={3} />
      <CardSkeleton rows={4} />
    </div>
  )

  if (error) return (
    <div className="max-w-3xl space-y-3">
      <Link href="/cotizaciones" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft className="w-3.5 h-3.5" /> Cotizaciones
      </Link>
      <ErrorAlert message={error} />
    </div>
  )

  if (!quote) return null

  const isTerminal       = ['emitted', 'lost'].includes(quote.status)
  const canAct           = !isTerminal
  const analyzedOptions  = quote.options.filter(o => o.is_analyzed)
  const sentOptions      = quote.options.filter(o => o.is_sent_to_client)
  const selectedOption   = quote.options.find(o => o.id === quote.selected_option_id)

  // Risk description
  const riskData  = (quote.risk?.data ?? {}) as Record<string, unknown>
  const riskLabel = [
    RISK_TYPE_LABELS[quote.risk?.type ?? ''] ?? quote.risk?.type,
    riskData['marca'] && riskData['modelo'] ? `${riskData['marca']} ${riskData['modelo']}` : null,
    riskData['anio'] ? String(riskData['anio']) : null,
    riskData['patente'] ? String(riskData['patente']) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="max-w-4xl space-y-4 animate-fade-in">

      {/* Dialogs */}
      {showMarkSent && (
        <MarkSentDialog
          options={analyzedOptions.map(o => ({
            id: o.id,
            company_name: o.company?.short_name ?? o.company?.name ?? '—',
            plan_name: o.plan_name,
            is_sent_to_client: o.is_sent_to_client,
          }))}
          onConfirm={async ids => { const r = await markSent(ids); if (r !== null) { toastSuccess('Cotización enviada al cliente'); setShowMarkSent(false) } }}
          onCancel={() => setShowMarkSent(false)}
          acting={acting}
        />
      )}
      {showSelectOpt && (
        <SelectOptionDialog
          options={sentOptions.length > 0
            ? sentOptions.map(o => ({ id: o.id, company_name: o.company?.name ?? '—', plan_name: o.plan_name, premium: o.premium, currency: o.currency }))
            : analyzedOptions.map(o => ({ id: o.id, company_name: o.company?.name ?? '—', plan_name: o.plan_name, premium: o.premium, currency: o.currency }))
          }
          onConfirm={async (optId, reason) => { const r = await selectOption(optId, reason); if (r !== null) { toastSuccess('Opción confirmada'); setShowSelectOpt(false) } }}
          onCancel={() => setShowSelectOpt(false)}
          acting={acting}
        />
      )}
      {showNewCase && (
        <NewCaseModal
          personId={quote.person?.id}
          personName={quote.person?.full_name}
          onClose={() => setShowNewCase(false)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link href="/cotizaciones"
            className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors shrink-0 mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-600 text-ink">Cotización</h1>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-ink-tertiary">
              {quote.person && (
                <Link href={`/personas/${quote.person.id}`}
                  className="flex items-center gap-1 hover:text-brand transition-colors">
                  <User className="w-3 h-3" /> {quote.person.full_name}
                </Link>
              )}
              {riskLabel && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {riskLabel}
                </span>
              )}
              {quote.producer && (
                <span>{quote.producer.full_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* Top actions */}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canAct && analyzedOptions.length > 0 && !selectedOption && (
            <Button variant="secondary" size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={() => setShowMarkSent(true)}>
              Marcar como enviada
            </Button>
          )}
          {canAct && quote.status !== 'draft' && !selectedOption && (
            <Button variant="primary" size="sm"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              onClick={() => setShowSelectOpt(true)}>
              El cliente eligió
            </Button>
          )}
        </div>
      </div>

      {actionError && <ErrorAlert message={actionError} onRetry={clearError} />}

      {/* ── Selection result (if chosen) ────────────────────────────────── */}
      {selectedOption && (
        <div className="card px-4 py-3 border-brand/30 bg-brand/5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-brand">El cliente eligió esta opción</p>
              <p className="text-sm text-ink mt-0.5">
                {selectedOption.company?.name} · {selectedOption.plan_name}
              </p>
              {quote.selection_reason && (
                <p className="text-xs text-ink-secondary mt-1">
                  <span className="font-500">Motivo:</span> {quote.selection_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sent status ─────────────────────────────────────────────────── */}
      {quote.sent_at && !selectedOption && (
        <div className="flex items-center gap-2 text-sm text-ink-secondary bg-info-bg border border-info/20 rounded-lg px-3 py-2">
          <Send className="w-4 h-4 text-info shrink-0" />
          <span>Enviada al cliente el {new Date(quote.sent_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}</span>
          {sentOptions.length > 0 && (
            <span className="text-ink-tertiary">— {sentOptions.length} opciones incluidas</span>
          )}
        </div>
      )}

      {/* ── Recommendation ──────────────────────────────────────────────── */}
      <div className="card px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-success shrink-0" />
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">
            Recomendación interna
          </p>
        </div>
        <RecommendationBox
          text={quote.internal_recommendation}
          onSave={updateRecommendation}
          acting={acting}
        />
      </div>

      {/* ── Options: analyzed ───────────────────────────────────────────── */}
      <OptionsSection
        title="Opciones analizadas"
        defaultOpen={true}
        badge={
          <span className="text-2xs bg-surface-muted text-ink-secondary px-1.5 py-0.5 rounded-full">
            {analyzedOptions.length}
          </span>
        }
        empty="Todavía no se cargaron opciones."
      >
        {analyzedOptions.length > 0 && (
          <div className="p-4 space-y-3">
            {analyzedOptions
              .sort((a, b) => {
                // Sort: selected first, then sent, then by sort_order
                if (a.id === quote.selected_option_id) return -1
                if (b.id === quote.selected_option_id) return 1
                if (a.is_sent_to_client && !b.is_sent_to_client) return -1
                if (!a.is_sent_to_client && b.is_sent_to_client) return 1
                return (a.sort_order ?? 0) - (b.sort_order ?? 0)
              })
              .map(option => (
                <QuoteOptionCard
                  key={option.id}
                  option={option}
                  isSelected={option.id === quote.selected_option_id}
                  isRecommended={false}   // recommendation is text, not per-option flag
                  quoteStatus={quote.status}
                  onToggleSent={toggleSentToClient}
                  onSelect={() => setShowSelectOpt(true)}
                  onRemove={removeOption}
                  acting={acting}
                  canAct={canAct}
                />
              ))
            }
          </div>
        )}
      </OptionsSection>

      {/* ── Options: sent to client (summary view) ──────────────────────── */}
      {sentOptions.length > 0 && (
        <OptionsSection
          title="Enviadas al cliente"
          defaultOpen={quote.status === 'sent_to_client'}
          badge={
            <span className="text-2xs bg-info-bg text-info-text px-1.5 py-0.5 rounded-full font-500">
              {sentOptions.length}
            </span>
          }
        >
          <div className="px-4 py-3 space-y-2">
            {sentOptions.map(o => (
              <div key={o.id} className={clsx(
                'flex items-center justify-between py-2 px-3 rounded-lg border',
                o.id === quote.selected_option_id
                  ? 'bg-brand/5 border-brand/30'
                  : 'bg-surface-subtle border-surface-border'
              )}>
                <div>
                  <p className="text-sm font-500">{o.company?.short_name ?? o.company?.name}</p>
                  <p className="text-xs text-ink-tertiary">{o.plan_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-600 tabular-nums">
                    {formatCurrency(o.premium, o.currency)}
                  </p>
                  {o.id === quote.selected_option_id && (
                    <p className="text-2xs text-brand font-500">✓ Elegida</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </OptionsSection>
      )}

      {/* ── PDF + next steps ────────────────────────────────────────────── */}
      <div className="card px-4 py-3">
        <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-3">Acciones</p>
        <div className="flex gap-2 flex-wrap">
          <Link href={`/cotizaciones/${id}/propuesta`}>
            <Button variant="secondary" size="sm" icon={<FileText className="w-3.5 h-3.5" />}>
              Ver propuesta comercial
            </Button>
          </Link>
          {quote.commercial_pdf_url && (
            <a href={quote.commercial_pdf_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm" icon={<Send className="w-3.5 h-3.5" />}>
                Ver PDF externo
              </Button>
            </a>
          )}
          <Button variant="ghost" size="sm"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => setShowNewCase(true)}>
            Crear caso relacionado
          </Button>
        </div>
        {quote.lost_reason && (
          <div className="mt-3 text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">
            <span className="font-500">Motivo de pérdida:</span> {quote.lost_reason}
          </div>
        )}
      </div>
    </div>
  )
}
