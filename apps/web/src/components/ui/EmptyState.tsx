import { clsx } from 'clsx'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="mb-4 w-12 h-12 rounded-xl bg-surface-muted flex items-center justify-center text-ink-tertiary">
          {icon}
        </div>
      )}
      <p className="text-sm font-500 text-ink">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-tertiary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
