import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size    = 'xs' | 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary:   'bg-brand text-white hover:bg-brand-dark active:bg-brand-dark',
  secondary: 'bg-surface border border-surface-border text-ink hover:bg-surface-subtle active:bg-surface-muted',
  ghost:     'text-ink-secondary hover:bg-surface-muted hover:text-ink active:bg-surface-muted',
  danger:    'bg-danger-bg text-danger hover:bg-danger hover:text-white border border-danger/20',
}

const sizes: Record<Size, string> = {
  xs: 'h-7  px-2.5 text-xs  gap-1.5',
  sm: 'h-8  px-3   text-sm  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     React.ReactNode
}

export function Button({
  variant = 'secondary', size = 'md', loading, icon,
  children, className, disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-500 rounded-lg',
        'transition-colors duration-100 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:focus-ring',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  )
}
