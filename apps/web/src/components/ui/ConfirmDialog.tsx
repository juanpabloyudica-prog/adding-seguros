'use client'

import { Button } from './Button'

interface ConfirmDialogProps {
  title:       string
  description: string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:    'danger' | 'warning' | 'default'
  loading?:    boolean
  onConfirm:   () => void
  onCancel:    () => void
}

export function ConfirmDialog({
  title, description, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  variant = 'default', loading, onConfirm, onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-surface rounded-xl w-full max-w-sm shadow-dropdown animate-fade-in p-5 space-y-4">
        <div>
          <p className="text-sm font-600 text-ink">{title}</p>
          <p className="text-sm text-ink-secondary mt-1">{description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'secondary' : 'primary'}
            size="sm"
            loading={loading}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
