'use client'

import { clsx } from 'clsx'
import { Check, Send, Star, Trash2, Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@adding/utils'
import type { QuoteOptionWithCompany } from '@/lib/api/quotes'

// ─── Coverage pills ───────────────────────────────────────────────────────────
function CoveragePills({ coverage }: { coverage: Record<string, unknown> }) {
  const entries = Object.entries(coverage).slice(0, 6)
  if (!entries.length) return <p className="text-xs text-ink-tertiary italic">Sin detalle de coberturas</p>

  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {entries.map(([key, val]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-surface-muted text-ink-secondary"
        >
          <span className="font-500 capitalize">{key.replace(/_/g, ' ')}</span>
          {val !== null && val !== true && (
            <span className="opacity-70">: {String(val)}</span>
          )}
        </span>
      ))}
      {Object.keys(coverage).length > 6 && (
        <span className="text-2xs text-ink-tertiary px-1">+{Object.keys(coverage).length - 6} más</span>
      )}
    </div>
  )
}

// ─── Ranking stars ────────────────────────────────────────────────────────────
function RankingStars({ ranking }: { ranking: number | null }) {
  if (!ranking) return null
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={clsx('w-3 h-3', i < ranking ? 'text-warning fill-warning' : 'text-surface-border')}
        />
      ))}
    </div>
  )
}

// ─── Option card ──────────────────────────────────────────────────────────────
interface QuoteOptionCardProps {
  option:            QuoteOptionWithCompany
  isSelected:        boolean
  isRecommended?:    boolean
  quoteStatus:       string
  onToggleSent:      (optionId: string, current: boolean) => void
  onSelect:          (optionId: string) => void
  onRemove:          (optionId: string) => void
  acting:            boolean
  canAct:            boolean  // false if quote is in terminal state
}

export function QuoteOptionCard({
  option, isSelected, isRecommended,
  quoteStatus, onToggleSent, onSelect, onRemove, acting, canAct,
}: QuoteOptionCardProps) {

  const isTerminal = ['emitted', 'lost'].includes(quoteStatus)

  return (
    <div className={clsx(
      'card transition-all duration-150',
      isSelected && 'ring-2 ring-brand border-brand',
      isRecommended && !isSelected && 'border-success/40',
    )}>
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-surface-border">
        {/* Company + plan */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-600 text-ink">
              {option.company?.short_name ?? option.company?.name ?? '—'}
            </p>
            <span className="text-xs text-ink-secondary">{option.plan_name}</span>
            <RankingStars ranking={option.company_ranking} />
          </div>
          {/* State chips */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {isSelected && (
              <span className="inline-flex items-center gap-1 text-2xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-500">
                <Check className="w-2.5 h-2.5" /> Elegida por el cliente
              </span>
            )}
            {isRecommended && (
              <span className="inline-flex items-center gap-1 text-2xs bg-success-bg text-success-text px-2 py-0.5 rounded-full font-500">
                <Star className="w-2.5 h-2.5" /> Recomendada
              </span>
            )}
            {option.is_sent_to_client && !isSelected && (
              <span className="inline-flex items-center gap-1 text-2xs bg-info-bg text-info-text px-2 py-0.5 rounded-full font-500">
                <Send className="w-2.5 h-2.5" /> Enviada al cliente
              </span>
            )}
            {!option.is_sent_to_client && option.is_analyzed && (
              <span className="text-2xs text-ink-tertiary">Solo analizada</span>
            )}
          </div>
        </div>

        {/* Premium */}
        <div className="text-right shrink-0">
          <p className="text-lg font-600 text-ink tabular-nums">
            {formatCurrency(option.premium, option.currency)}
          </p>
          <p className="text-2xs text-ink-tertiary">{option.currency} / mes</p>
        </div>
      </div>

      {/* Coverage */}
      {Object.keys(option.coverage ?? {}).length > 0 && (
        <div className="px-4 py-2.5 border-b border-surface-border">
          <CoveragePills coverage={option.coverage} />
        </div>
      )}

      {/* Internal notes */}
      {option.internal_notes && (
        <div className="px-4 py-2 border-b border-surface-border bg-surface-subtle">
          <p className="text-2xs text-ink-tertiary font-500 uppercase tracking-wide mb-0.5">Nota interna</p>
          <p className="text-sm text-ink-secondary">{option.internal_notes}</p>
        </div>
      )}

      {/* Actions */}
      {canAct && !isTerminal && (
        <div className="flex items-center gap-1 px-4 py-2.5 flex-wrap">
          {/* Toggle sent to client */}
          <button
            onClick={() => onToggleSent(option.id, option.is_sent_to_client)}
            disabled={acting}
            className={clsx(
              'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-colors',
              option.is_sent_to_client
                ? 'bg-info-bg text-info hover:bg-info hover:text-white'
                : 'bg-surface-muted text-ink-secondary hover:bg-info-bg hover:text-info'
            )}
          >
            {option.is_sent_to_client
              ? <><EyeOff className="w-3 h-3" /> Quitar del envío</>
              : <><Eye className="w-3 h-3" /> Incluir en envío</>
            }
          </button>

          {/* Select option (client chose) */}
          {!isSelected && (
            <button
              onClick={() => onSelect(option.id)}
              disabled={acting}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-surface-muted text-ink-secondary hover:bg-brand/10 hover:text-brand transition-colors"
            >
              <Check className="w-3 h-3" /> El cliente eligió esta
            </button>
          )}

          {/* Remove */}
          {!isSelected && (
            <button
              onClick={() => onRemove(option.id)}
              disabled={acting}
              className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-ink-tertiary hover:bg-danger-bg hover:text-danger transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
