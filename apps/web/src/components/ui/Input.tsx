import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  icon?: React.ReactNode
}

export function Input({ label, error, hint, icon, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-500 text-ink-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={clsx(
            'w-full h-9 rounded-lg border bg-surface text-sm text-ink',
            'placeholder:text-ink-disabled transition-colors duration-100',
            'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
            icon ? 'pl-8 pr-3' : 'px-3',
            error
              ? 'border-danger focus:ring-danger'
              : 'border-surface-border hover:border-surface-border-strong',
            props.disabled && 'bg-surface-subtle opacity-60 cursor-not-allowed',
            className
          )}
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-tertiary">{hint}</p>}
    </div>
  )
}
