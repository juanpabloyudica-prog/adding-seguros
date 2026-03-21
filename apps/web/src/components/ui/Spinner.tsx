import { clsx } from 'clsx'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      className={clsx(
        'inline-block border-2 border-surface-border border-t-brand rounded-full animate-spin',
        sizes[size],
        className
      )}
      role="status"
      aria-label="Cargando"
    />
  )
}
