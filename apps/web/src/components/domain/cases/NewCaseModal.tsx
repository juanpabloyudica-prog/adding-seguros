'use client'

import { useState } from 'react'
import { X, FolderOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createCase, linkCaseConversation } from '@/lib/api/cases'

const CASE_TYPES = [
  { value: 'prospecto',    label: 'Prospecto'    },
  { value: 'recotizacion', label: 'Recotización' },
  { value: 'incidencia',   label: 'Incidencia'   },
  { value: 'siniestro',    label: 'Siniestro'    },
  { value: 'reclamo',      label: 'Reclamo'      },
  { value: 'consulta',     label: 'Consulta'     },
  { value: 'endoso',       label: 'Endoso'       },
  { value: 'otros',        label: 'Otros'        },
]

const PRIORITIES = [
  { value: 'low',    label: 'Baja'    },
  { value: 'medium', label: 'Media'   },
  { value: 'high',   label: 'Alta'    },
  { value: 'urgent', label: 'Urgente' },
]

interface NewCaseModalProps {
  // Pre-filled context
  personId?:       string
  personName?:     string
  policyId?:       string
  policyNumber?:   string
  conversationId?: string
  onClose:         () => void
  onCreated?:      (caseId: string) => void
}

export function NewCaseModal({
  personId, personName, policyId, policyNumber,
  conversationId, onClose, onCreated,
}: NewCaseModalProps) {
  const router = useRouter()
  const [title,       setTitle]       = useState('')
  const [type,        setType]        = useState('consulta')
  const [priority,    setPriority]    = useState('medium')
  const [description, setDescription] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!personId || !title.trim()) return

    setLoading(true)
    setError(null)
    try {
      const result = await createCase({
        person_id:   personId,
        policy_id:   policyId,
        type,
        priority,
        title:       title.trim(),
        description: description.trim() || undefined,
      }, `new-case-${Date.now()}`)

      const caseId = result.data.id

      // Link conversation if provided
      if (conversationId) {
        await linkCaseConversation(caseId, conversationId)
      }

      onCreated?.(caseId)
      router.push(`/gestiones/${caseId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear caso')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface rounded-xl w-full max-w-md shadow-dropdown animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-600 text-ink">Nuevo caso</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink p-0.5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context chips */}
        {(personName || policyNumber || conversationId) && (
          <div className="flex gap-2 flex-wrap px-4 pt-3">
            {personName && (
              <span className="text-2xs bg-brand/10 text-brand px-2 py-1 rounded-full font-500">
                👤 {personName}
              </span>
            )}
            {policyNumber && (
              <span className="text-2xs bg-success-bg text-success-text px-2 py-1 rounded-full font-500">
                🛡 Póliza {policyNumber}
              </span>
            )}
            {conversationId && (
              <span className="text-2xs bg-info-bg text-info-text px-2 py-1 rounded-full font-500">
                💬 Conversación vinculada
              </span>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <Input
disabled={submitting}             label="Título"
            placeholder="Ej: Siniestro vehículo patente ABC123"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-500 text-ink-secondary">Tipo</label>
              <select
disabled={submitting}                 value={type}
                onChange={e => setType(e.target.value)}
                className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {CASE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-500 text-ink-secondary">Prioridad</label>
              <select
disabled={submitting}                 value={priority}
                onChange={e => setPriority(e.target.value)}
                className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-500 text-ink-secondary">Descripción (opcional)</label>
            <textarea
disabled={submitting}               value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalle del caso…"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface text-ink resize-none focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {error && (
            <p className="text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" variant="primary" size="md" loading={loading}
              disabled={!title.trim() || !personId} className="flex-1">
              Crear caso
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
