'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import {
  ChevronDown,
  Link2, CheckCircle2, StickyNote} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

const STATUS_TRANSITIONS: Record<string, { value: string; label: string; variant: 'default'|'danger'|'success' }[]> = {
  open:            [
    { value: 'in_progress',     label: 'Iniciar',            variant: 'success' },
    { value: 'waiting_client',  label: 'Esp. cliente',       variant: 'default' },
    { value: 'waiting_company', label: 'Esp. compañía',      variant: 'default' },
    { value: 'cancelled',       label: 'Cancelar',           variant: 'danger'  },
  ],
  in_progress:     [
    { value: 'waiting_client',  label: 'Esp. cliente',       variant: 'default' },
    { value: 'waiting_company', label: 'Esp. compañía',      variant: 'default' },
    { value: 'resolved',        label: 'Resolver',           variant: 'success' },
    { value: 'cancelled',       label: 'Cancelar',           variant: 'danger'  },
  ],
  waiting_client:  [
    { value: 'in_progress',     label: 'Retomar',            variant: 'default' },
    { value: 'resolved',        label: 'Resolver',           variant: 'success' },
    { value: 'cancelled',       label: 'Cancelar',           variant: 'danger'  },
  ],
  waiting_company: [
    { value: 'in_progress',     label: 'Retomar',            variant: 'default' },
    { value: 'resolved',        label: 'Resolver',           variant: 'success' },
    { value: 'cancelled',       label: 'Cancelar',           variant: 'danger'  },
  ],
  escalated:       [
    { value: 'in_progress',     label: 'Retomar',            variant: 'default' },
    { value: 'resolved',        label: 'Resolver',           variant: 'success' },
    { value: 'cancelled',       label: 'Cancelar',           variant: 'danger'  },
  ],
  resolved:        [
    { value: 'closed',          label: 'Cerrar definitivo',  variant: 'success' },
    { value: 'in_progress',     label: 'Reabrir',            variant: 'default' },
  ]}

interface CaseActionsProps {
  caseId:          string
  currentStatus:   string
  hasConversation: boolean
  onStatusChange:  (status: string) => Promise<unknown>
  onAddNote:       (note: string) => Promise<unknown>
  onClose:         (result: string, type: string) => Promise<unknown>
  onLinkConversation?: () => void
  acting:          boolean
  error:           string | null
  onClearError:    () => void
}

export function CaseActions({
  caseId, currentStatus, hasConversation,
  onStatusChange, onAddNote, onClose, onLinkConversation,
  acting, error, onClearError}: CaseActionsProps) {
  const [confirmPending, setConfirmPending] = useState<{ status: string; label: string } | null>(null)
  const [noteText,    setNoteText]    = useState('')
  const [noteOpen,    setNoteOpen]    = useState(false)
  const [closeOpen,   setCloseOpen]   = useState(false)
  const [closeResult, setCloseResult] = useState('')
  const [closeType,   setCloseType]   = useState('resuelto')
  const [statusOpen,  setStatusOpen]  = useState(false)

  const isClosed  = currentStatus === 'closed' || currentStatus === 'cancelled'
  const transitions = STATUS_TRANSITIONS[currentStatus] ?? []

  const handleNote = async () => {
    if (!noteText.trim()) return
    const ok = await onAddNote(noteText.trim())
    if (ok) { setNoteText(''); setNoteOpen(false) }
  }

  const handleClose = async () => {
    if (!closeResult.trim()) return
    const ok = await onClose(closeResult.trim(), closeType)
    if (ok) setCloseOpen(false)
  }

  return (
    <>
    <div className="space-y-3">
      {error && <ErrorAlert message={error} onRetry={onClearError} />}

      {/* Status change button */}
      {!isClosed && transitions.length > 0 && (
        <div className="relative">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<Shuffle className="w-3.5 h-3.5" />}
            onClick={() => setStatusOpen(s => !s)}
            loading={acting && statusOpen}
          >
            Cambiar estado <ChevronDown className="w-3.5 h-3.5 ml-auto" />
          </Button>
          {statusOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 card shadow-dropdown py-1 animate-fade-in">
                {transitions.map(t => (
                  <button
                    key={t.value}
                    disabled={acting}
                    onClick={() => {
                      if (t.variant === 'danger') {
                        setConfirmPending({ status: t.value, label: t.label })
                        setStatusOpen(false)
                      } else {
                        onStatusChange(t.value)
                        setStatusOpen(false)
                      }
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-subtle',
                      t.variant === 'danger' && 'text-danger hover:bg-danger-bg',
                      t.variant === 'success' && 'text-success hover:bg-success-bg'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Close case (always available for non-closed) */}
      {!isClosed && (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => setCloseOpen(o => !o)}
          >
            Cerrar caso
          </Button>
          {closeOpen && (
            <div className="space-y-2 p-3 bg-surface-subtle rounded-lg border border-surface-border animate-fade-in">
              <p className="text-xs font-500 text-ink">Cerrar caso</p>
              <select
                value={closeType}
                onChange={e => setCloseType(e.target.value)}
                className="w-full h-8 text-sm px-2 border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="ganado">Ganado</option>
                <option value="perdido">Perdido</option>
                <option value="resuelto">Resuelto</option>
                <option value="sin_resultado">Sin resultado</option>
              </select>
              <textarea
                value={closeResult}
                onChange={e => setCloseResult(e.target.value)}
                placeholder="Descripción del resultado…"
                rows={2}
                className="w-full text-sm px-2 py-1.5 border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="flex gap-2">
                <Button variant="primary" size="xs" onClick={handleClose} loading={acting}
                  disabled={!closeResult.trim()}>Confirmar</Button>
                <Button variant="ghost" size="xs" onClick={() => setCloseOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add note */}
      {!isClosed && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-ink-secondary"
            icon={<StickyNote className="w-3.5 h-3.5" />}
            onClick={() => setNoteOpen(o => !o)}
          >
            Agregar nota
          </Button>
          {noteOpen && (
            <div className="space-y-2 animate-fade-in">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Escribe una nota interna…"
                rows={3}
                className="w-full text-sm px-3 py-2 border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="primary" size="xs" onClick={handleNote} loading={acting}
                  disabled={!noteText.trim()}>Guardar nota</Button>
                <Button variant="ghost" size="xs" onClick={() => { setNoteOpen(false); setNoteText('') }}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Link / go to conversation */}
      {!hasConversation && onLinkConversation && !isClosed && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-ink-secondary"
          icon={<Link2 className="w-3.5 h-3.5" />}
          onClick={onLinkConversation}
        >
          Vincular conversación
        </Button>
      )}
    </div>
  )
}

// Inline since it's only used here
function Shuffle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </svg>

      {confirmPending && (
        <ConfirmDialog
          title={`¿${confirmPending.label} la gestión?`}
          description={`Va a pasar a "${STATUS_LABELS[confirmPending.status] ?? confirmPending.status}". Podés revertir este cambio después.`}
          confirmLabel={confirmPending.label}
          variant="danger"
          loading={acting}
          onConfirm={async () => { await onStatusChange(confirmPending.status); setConfirmPending(null) }}
          onCancel={() => setConfirmPending(null)}
        />
      )}
    </>
  )
}