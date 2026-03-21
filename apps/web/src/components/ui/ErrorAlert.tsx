import { AlertCircle } from 'lucide-react'

interface ErrorAlertProps {
  message:  string
  title?:   string      // defaults to "Error"
  onRetry?: () => void
}

export function ErrorAlert({ message, title = 'Error', onRetry }: ErrorAlertProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-danger-bg border border-danger/20 text-danger-text">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-500">{title}</p>
        <p className="text-sm opacity-80 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-500 underline hover:no-underline shrink-0"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
