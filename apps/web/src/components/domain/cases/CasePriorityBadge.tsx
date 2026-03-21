import { clsx } from 'clsx'

const CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  urgent: { label: 'Urgente', classes: 'bg-danger-bg text-danger',   dot: 'bg-danger'   },
  high:   { label: 'Alta',    classes: 'bg-warning-bg text-warning', dot: 'bg-warning'  },
  medium: { label: 'Media',   classes: 'bg-info-bg text-info',       dot: 'bg-info'     },
  low:    { label: 'Baja',    classes: 'bg-surface-muted text-ink-secondary', dot: 'bg-surface-border-strong' },
}

export function CasePriorityBadge({ priority, compact = false }: { priority: string; compact?: boolean }) {
  const cfg = CONFIG[priority] ?? CONFIG.medium!
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full font-500', cfg.classes,
      compact ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs')}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {!compact && cfg.label}
    </span>
  )
}
