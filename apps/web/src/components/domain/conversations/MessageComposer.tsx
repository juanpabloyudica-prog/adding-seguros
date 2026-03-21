'use client'

import { useState, useRef, useCallback } from 'react'
import { Send, Lock, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'

interface MessageComposerProps {
  onSend:     (content: string, type: 'manual' | 'internal') => Promise<unknown>
  sending:    boolean
  disabled?:  boolean
  placeholder?: string
}

export function MessageComposer({ onSend, sending, disabled, placeholder }: MessageComposerProps) {
  const [content, setContent]     = useState('')
  const [mode, setMode]           = useState<'manual' | 'internal'>('manual')
  const textareaRef               = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(async () => {
    if (!content.trim() || sending || disabled) return
    const result = await onSend(content, mode)
    if (result) {
      setContent('')
      textareaRef.current?.focus()
    }
  }, [content, mode, onSend, sending, disabled])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter sends
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
    // Escape clears
    if (e.key === 'Escape') {
      setContent('')
    }
  }, [handleSend])

  // Auto-resize textarea
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const t = e.target
    t.style.height = 'auto'
    t.style.height = Math.min(t.scrollHeight, 160) + 'px'
  }

  const isInternal = mode === 'internal'

  return (
    <div className={clsx(
      'border-t border-surface-border p-3',
      isInternal ? 'bg-warning-bg/30' : 'bg-surface'
    )}>
      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setMode('manual')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-500 transition-colors',
            mode === 'manual'
              ? 'bg-brand/10 text-brand'
              : 'text-ink-tertiary hover:text-ink hover:bg-surface-muted'
          )}
        >
          <Send className="w-3 h-3" /> Responder
        </button>
        <button
          onClick={() => setMode('internal')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-500 transition-colors',
            mode === 'internal'
              ? 'bg-warning/10 text-warning'
              : 'text-ink-tertiary hover:text-ink hover:bg-surface-muted'
          )}
        >
          <Lock className="w-3 h-3" /> Nota interna
        </button>

        {content && (
          <button
            onClick={() => setContent('')}
            className="ml-auto text-ink-tertiary hover:text-ink p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Textarea + send button */}
      <div className={clsx(
        'flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors',
        isInternal
          ? 'border-warning/30 bg-warning-bg/50 focus-within:border-warning/60'
          : 'border-surface-border bg-surface focus-within:border-brand/40'
      )}>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          rows={1}
          placeholder={
            placeholder ??
            (isInternal ? 'Nota interna (solo visible para el equipo)…' : 'Escribí un mensaje…')
          }
          className={clsx(
            'flex-1 resize-none bg-transparent text-sm text-ink',
            'placeholder:text-ink-disabled outline-none',
            'disabled:opacity-50 min-h-[36px] max-h-[160px] py-1',
            'scrollbar-hide'
          )}
          style={{ height: 'auto' }}
        />
        <Button
          variant={isInternal ? 'ghost' : 'primary'}
          size="sm"
          onClick={handleSend}
          loading={sending}
          disabled={!content.trim() || disabled}
          className={clsx('shrink-0 mb-0.5', isInternal && 'text-warning hover:bg-warning/10')}
          icon={isInternal ? <Lock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
        >
          <span className="hidden sm:inline">{isInternal ? 'Guardar' : 'Enviar'}</span>
        </Button>
      </div>

      <p className="text-2xs text-ink-tertiary mt-1.5">
        {isInternal
          ? 'Solo visible para el equipo — no se envía al cliente'
          : 'Cmd+Enter para enviar'}
      </p>
    </div>
  )
}
