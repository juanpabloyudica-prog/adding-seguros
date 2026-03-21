import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'
  | 'active' | 'expiring' | 'expired' | 'cancelled' | 'draft'

const variantClasses: Record<BadgeVariant, string> = {
  default:   'bg-surface-muted  text-ink-secondary',
  muted:     'bg-surface-muted  text-ink-tertiary',
  success:   'bg-success-bg     text-success-text',
  warning:   'bg-warning-bg     text-warning-text',
  danger:    'bg-danger-bg      text-danger-text',
  info:      'bg-info-bg        text-info-text',
  // Policy-specific (maps to semantic)
  active:    'bg-success-bg     text-success-text',
  expiring:  'bg-warning-bg     text-warning-text',
  expired:   'bg-surface-muted  text-ink-secondary',
  cancelled: 'bg-danger-bg      text-danger-text',
  draft:     'bg-info-bg        text-info-text',
}

const POLICY_STATUS_LABELS: Record<string, string> = {
  active:    'Activa',
  expiring:  'Por vencer',
  expired:   'Vencida',
  cancelled: 'Cancelada',
  draft:     'Borrador',
}

interface BadgeProps {
  children?: React.ReactNode
  variant?:  BadgeVariant
  status?:   string   // for policy/case statuses — auto-maps label + variant
  className?: string
}

export function Badge({ children, variant = 'default', status, className }: BadgeProps) {
  const resolvedVariant = status ? (status as BadgeVariant) : variant
  const label = children ?? (status ? POLICY_STATUS_LABELS[status] ?? status : '')

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-500 tracking-wide',
        variantClasses[resolvedVariant] ?? variantClasses.default,
        className
      )}
    >
      {label}
    </span>
  )
}
