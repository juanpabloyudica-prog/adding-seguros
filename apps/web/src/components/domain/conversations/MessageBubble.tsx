import { clsx } from 'clsx'
import { Lock } from 'lucide-react'
import type { MessageWithSender } from '@/lib/api/conversations'

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const STATUS_ICONS: Record<string, string> = {
  pending:   '·',    // animated in CSS via opacity
  sent:      '✓',
  delivered: '✓✓',
  read:      '✓✓',
  failed:    '✗',
}

interface MessageBubbleProps {
  message: MessageWithSender
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isInternal = message.is_internal_note || message.type === 'internal'
  const isOutbound = message.direction === 'outbound'

  // ── Internal note ─────────────────────────────────────────────────────────
  if (isInternal) {
    return (
      <div className="flex justify-center my-1">
        <div className="max-w-[85%] sm:max-w-[70%] bg-warning-bg border border-warning/20 rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="w-3 h-3 text-warning" />
            <span className="text-2xs font-500 text-warning">Nota interna</span>
            {message.sender_name && (
              <span className="text-2xs text-warning/70">· {message.sender_name}</span>
            )}
          </div>
          <p className="text-sm text-ink whitespace-pre-wrap break-words">{message.content}</p>
          <p className="text-right text-2xs text-ink-tertiary mt-1">
            {formatTime(message.sent_at)}
          </p>
        </div>
      </div>
    )
  }

  // ── Outbound ──────────────────────────────────────────────────────────────
  if (isOutbound) {
    return (
      <div className="flex justify-end mb-2">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className={clsx("bg-brand text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 shadow-card", message.status === 'pending' && 'opacity-75')}>
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            <div className="flex items-center justify-end gap-1.5 mt-1">
              {message.sender_name && (
                <span className="text-2xs opacity-70">{message.sender_name}</span>
              )}
              <span className="text-2xs opacity-70">{formatTime(message.sent_at)}</span>
              <span className={clsx(
                'text-2xs',
                message.status === 'failed' ? 'text-danger/80' : 'opacity-70'
              )}>
                {STATUS_ICONS[message.status] ?? ''}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Inbound ───────────────────────────────────────────────────────────────
  return (
    <div className="flex justify-start mb-2">
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div className="bg-surface border border-surface-border rounded-2xl rounded-bl-sm px-3.5 py-2.5 shadow-card">
          <p className="text-sm text-ink whitespace-pre-wrap break-words">{message.content}</p>
          <p className="text-right text-2xs text-ink-tertiary mt-1">
            {formatTime(message.sent_at)}
          </p>
        </div>
      </div>
    </div>
  )
}
