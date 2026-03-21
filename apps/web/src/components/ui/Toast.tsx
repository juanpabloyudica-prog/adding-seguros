'use client'

import { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  title:   string
  message?: string
  duration?: number  // ms, default 4000; 0 = persistent
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

// ─── Single toast item ────────────────────────────────────────────────────────
const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-success-bg',  icon: 'text-success', border: 'border-success/20' },
  error:   { bg: 'bg-danger-bg',   icon: 'text-danger',  border: 'border-danger/20'  },
  warning: { bg: 'bg-warning-bg',  icon: 'text-warning', border: 'border-warning/20' },
  info:    { bg: 'bg-info-bg',     icon: 'text-info',    border: 'border-info/20'    },
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon   = ICONS[toast.type]
  const styles = STYLES[toast.type]

  useEffect(() => {
    const dur = toast.duration ?? 4000
    if (dur === 0) return
    const t = setTimeout(() => onDismiss(toast.id), dur)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div className={clsx(
      'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-dropdown',
      'min-w-[280px] max-w-sm animate-fade-in',
      styles.bg, styles.border
    )}>
      <Icon className={clsx('w-4 h-4 shrink-0 mt-0.5', styles.icon)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-500 text-ink">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-ink-secondary mt-0.5">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 text-ink-tertiary hover:text-ink rounded transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Provider + container ─────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts(prev => [...prev.slice(-4), { id, ...opts }])  // max 5 visible
  }, [])

  const success = useCallback((title: string, message?: string) =>
    toast({ type: 'success', title, message }), [toast])
  const error   = useCallback((title: string, message?: string) =>
    toast({ type: 'error', title, message, duration: 6000 }), [toast])
  const warning = useCallback((title: string, message?: string) =>
    toast({ type: 'warning', title, message }), [toast])
  const info    = useCallback((title: string, message?: string) =>
    toast({ type: 'info', title, message }), [toast])

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container — bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
