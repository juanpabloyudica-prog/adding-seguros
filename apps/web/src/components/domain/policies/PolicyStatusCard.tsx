import { clsx } from 'clsx'
import { Skeleton } from '@/components/ui/Skeleton'

interface PolicyStatusCardProps {
  label:    string
  value:    number | string
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'muted'
  loading?: boolean
}

const variantStyles: Record<NonNullable<PolicyStatusCardProps['variant']>, string> = {
  default: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  muted:   'text-ink-secondary',
}

export function PolicyStatusCard({ label, value, variant = 'default', loading }: PolicyStatusCardProps) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="text-xs text-ink-tertiary font-500 uppercase tracking-wide">{label}</p>
      {loading
        ? <Skeleton className="h-8 w-16 mt-1" />
        : <p className={clsx('text-2xl font-600 tabular-nums', variantStyles[variant])}>{value}</p>
      }
    </div>
  )
}
