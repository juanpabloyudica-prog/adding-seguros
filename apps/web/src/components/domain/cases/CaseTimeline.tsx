import { clsx } from 'clsx'
import {
  GitCommit, MessageSquare, Shuffle, AlertTriangle, ArrowRight,
  User, Paperclip, Zap, CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import type { CaseTimelineEntry } from '@adding/types'

type TimelineEntry = CaseTimelineEntry & {
  performer?: { id: string; full_name: string } | null
}

// ─── Config per timeline entry type ──────────────────────────────────────────
const TYPE_CONFIG: Record<string, {
  icon:    React.ElementType
  color:   string
  bgColor: string
  label:   string
}> = {
  status_change:  { icon: Shuffle,       color: 'text-brand',         bgColor: 'bg-brand/10',      label: 'Cambio de estado'     },
  step_change:    { icon: GitCommit,     color: 'text-success',       bgColor: 'bg-success-bg',    label: 'Avance de paso'       },
  note:           { icon: MessageSquare, color: 'text-warning',       bgColor: 'bg-warning-bg',    label: 'Nota interna'         },
  assignment:     { icon: User,          color: 'text-info',          bgColor: 'bg-info-bg',       label: 'Asignación'           },
  document_added: { icon: Paperclip,     color: 'text-ink-secondary', bgColor: 'bg-surface-muted', label: 'Documento'            },
  message_sent:   { icon: MessageSquare, color: 'text-ink-secondary', bgColor: 'bg-surface-muted', label: 'Mensaje enviado'      },
  escalation:     { icon: AlertTriangle, color: 'text-danger',        bgColor: 'bg-danger-bg',     label: 'Escalamiento'         },
  system_event:   { icon: Zap,           color: 'text-purple-500',    bgColor: 'bg-purple-50',     label: 'Automatización'       },
}

// ─── Action labels for system_event notes (automation actions) ────────────────
// These match what automations.tracing.ts writes at the start of notes
const AUTOMATION_ICONS: Record<string, React.ElementType> = {
  'Mensaje automático enviado':       CheckCircle2,
  'Error al enviar mensaje automático': XCircle,
  'Mensaje automático cancelado':     XCircle,
  'Regla disparada manualmente':      Zap,
  'Regla disparada automáticamente':  Zap,
  'Mensaje automático programado':    Clock,
}

const AUTOMATION_COLORS: Record<string, string> = {
  'Mensaje automático enviado':         'text-success',
  'Error al enviar mensaje automático': 'text-danger',
  'Mensaje automático cancelado':       'text-ink-tertiary',
  'Regla disparada manualmente':        'text-brand',
  'Regla disparada automáticamente':    'text-purple-500',
  'Mensaje automático programado':      'text-info',
}

// Status labels in Spanish
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto', in_progress: 'En progreso', waiting_client: 'Esp. cliente',
  waiting_company: 'Esp. compañía', escalated: 'Escalado',
  resolved: 'Resuelto', closed: 'Cerrado', cancelled: 'Cancelado',
}

function formatTimestamp(iso: string): string {
  const d     = new Date(iso)
  const now   = new Date()
  const diffMs    = now.getTime() - d.getTime()
  const diffMins  = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays  = Math.floor(diffHours / 24)

  if (diffMins  < 1)  return 'ahora'
  if (diffMins  < 60) return `hace ${diffMins}m`
  if (diffHours < 24) return `hace ${diffHours}h`
  if (diffDays  < 7)  return `hace ${diffDays}d`
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short',
    year: diffDays > 365 ? 'numeric' : undefined,
  })
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── System event description (automations) ───────────────────────────────────
// The notes field from automations.tracing.ts looks like:
//   "Mensaje automático programado · regla "recordatorio 7d" — disparado por policy_expiring_7d"
// We parse the first segment as the action and render it with context.
function AutomationDescription({ notes }: { notes: string | null }) {
  if (!notes) {
    return <span className="text-ink-tertiary italic">Automatización ejecutada</span>
  }

  // Find which action label appears at the start
  const matchedAction = Object.keys(AUTOMATION_ICONS).find(a => notes.startsWith(a))

  if (!matchedAction) {
    // Generic: just show the notes text
    return <span className="text-sm text-ink">{notes}</span>
  }

  const Icon  = AUTOMATION_ICONS[matchedAction]!
  const color = AUTOMATION_COLORS[matchedAction] ?? 'text-ink-secondary'
  const rest  = notes.slice(matchedAction.length).trim()

  return (
    <span className="flex items-start gap-1.5 flex-wrap">
      <span className={clsx('flex items-center gap-1 font-500', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {matchedAction}
      </span>
      {rest && (
        <span className="text-ink-secondary text-xs">{rest}</span>
      )}
    </span>
  )
}

// ─── Single entry ──────────────────────────────────────────────────────────────
function TimelineEntryRow({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const cfg  = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.system_event!
  const Icon = cfg.icon

  let description: React.ReactNode

  if (entry.type === 'status_change') {
    description = (
      <span className="flex items-center gap-1.5 flex-wrap">
        {entry.from_value && (
          <><span className="font-500 text-ink">{STATUS_LABELS[entry.from_value] ?? entry.from_value}</span>
          <ArrowRight className="w-3 h-3 text-ink-tertiary shrink-0" /></>
        )}
        <span className="font-500 text-ink">{STATUS_LABELS[entry.to_value ?? ''] ?? entry.to_value}</span>
        {entry.notes && <span className="text-ink-secondary">· {entry.notes}</span>}
      </span>
    )
  } else if (entry.type === 'step_change') {
    description = (
      <span className="flex items-center gap-1.5 flex-wrap">
        {entry.from_value && (
          <><span className="font-500 text-ink">{entry.from_value}</span>
          <ArrowRight className="w-3 h-3 text-ink-tertiary shrink-0" /></>
        )}
        <span className="font-500 text-ink">{entry.to_value}</span>
        {entry.notes && <span className="text-ink-secondary">· {entry.notes}</span>}
      </span>
    )
  } else if (entry.type === 'system_event') {
    description = <AutomationDescription notes={entry.notes} />
  } else {
    description = entry.notes
      ? <span className="text-sm text-ink">{entry.notes}</span>
      : null
  }

  return (
    <div className="flex gap-3 group">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', cfg.bgColor)}>
          <Icon className={clsx('w-3.5 h-3.5', cfg.color)} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-surface-border mt-1 mb-0 min-h-[16px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-500 text-ink-secondary">{cfg.label}</p>
            <div className="text-sm text-ink mt-0.5 break-words">
              {description ?? <span className="text-ink-tertiary italic">Sin detalle</span>}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            {entry.performer ? (
              <p className="text-xs font-500 text-ink-secondary">
                {entry.performer.full_name.split(' ')[0]}
              </p>
            ) : (
              <p className="text-2xs text-ink-tertiary italic">Sistema</p>
            )}
            <p
              title={formatFullDate(entry.created_at)}
              className="text-2xs text-ink-tertiary whitespace-nowrap cursor-default"
            >
              {formatTimestamp(entry.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Day separator ────────────────────────────────────────────────────────────
function DaySeparator({ date }: { date: string }) {
  const d         = new Date(date)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  let label: string
  if (d.toDateString() === today.toDateString())         label = 'Hoy'
  else if (d.toDateString() === yesterday.toDateString()) label = 'Ayer'
  else label = d.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <div className="flex items-center gap-3 my-3 px-4">
      <div className="flex-1 h-px bg-surface-border" />
      <span className="text-2xs font-500 text-ink-tertiary capitalize whitespace-nowrap px-2">
        {label}
      </span>
      <div className="flex-1 h-px bg-surface-border" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface CaseTimelineProps {
  entries:  TimelineEntry[]
  loading?: boolean
}

export function CaseTimeline({ entries, loading }: CaseTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4 px-4 py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-surface-muted shrink-0 animate-pulse" />
            <div className="flex-1 space-y-1.5 pt-1">
              <div className="h-3 w-24 bg-surface-muted rounded animate-pulse" />
              <div className="h-4 w-48 bg-surface-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-ink-tertiary">
        Sin actividad registrada todavía.
      </div>
    )
  }

  let lastDay = ''

  return (
    <div className="py-2">
      {entries.map((entry, i) => {
        const entryDay      = new Date(entry.created_at).toDateString()
        const showSeparator = entryDay !== lastDay
        lastDay = entryDay

        return (
          <div key={entry.id}>
            {showSeparator && <DaySeparator date={entry.created_at} />}
            <div className="px-4">
              <TimelineEntryRow entry={entry} isLast={i === entries.length - 1} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
