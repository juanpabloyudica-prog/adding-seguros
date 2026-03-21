'use client'

import { useState, useEffect } from 'react'
import { Eye, X } from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { extractTemplateVariables } from '@adding/utils'

const TEMPLATE_TYPES = [
  { value: 'onboarding', label: 'Bienvenida'  },
  { value: 'event',      label: 'Evento'      },
  { value: 'adhoc',      label: 'Puntual'     },
  { value: 'recurring',  label: 'Recurrente'  },
]

// ─── Sample variables for preview ────────────────────────────────────────────
const SAMPLE_VARS: Record<string, string> = {
  nombre:             'Juan Pérez',
  patente:            'ABC 123',
  marca:              'Toyota',
  modelo:             'Corolla',
  anio:               '2021',
  compania:           'Federación Patronal',
  fecha_vencimiento:  '31/12/2025',
  numero_poliza:      'ABCD-001234',
  ramo:               'Auto',
  productor:          'Carlos García',
  dias_para_vencer:   '15',
  monto_prima:        '$45.000',
}

function VariablePill({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-2xs px-1.5 py-0.5 rounded bg-brand/10 text-brand font-mono hover:bg-brand/20 transition-colors"
    >
      {`{{${name}}}`}
    </button>
  )
}

interface TemplateFormProps {
  templateId?: string
  initial?: {
    name?: string; type?: string; category?: string; body?: string; is_active?: boolean
  }
  onSave:  (data: Record<string, unknown>, id?: string) => Promise<unknown>
  onClose: () => void
  acting:  boolean
  error:   string | null
}

const AVAILABLE_VARS = Object.keys(SAMPLE_VARS)

export function TemplateForm({ templateId, initial, onSave, onClose, acting, error }: TemplateFormProps) {
  const [name,     setName]     = useState(initial?.name ?? '')
  const [type,     setType]     = useState(initial?.type ?? 'event')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [body,     setBody]     = useState(initial?.body ?? '')
  const [preview,  setPreview]  = useState(false)

  // Auto-detect variables used in body
  const usedVars = extractTemplateVariables(body)

  // Live preview with sample data
  const previewText = body.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    SAMPLE_VARS[key] ?? `[?${key}]`
  )

  const insertVar = (varName: string) => {
    setBody(prev => prev + `{{${varName}}}`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name: name.trim(), type, category: category.trim() || undefined, body: body.trim(),
    }, templateId)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface rounded-xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-dropdown animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
          <h2 className="text-sm font-600">{templateId ? 'Editar template' : 'Nuevo template'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <Input disabled={acting}
                label="Nombre del template"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Ej: Recordatorio vencimiento 7 días"
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-500 text-ink-secondary">Tipo</label>
                <select disabled={acting} value={type} onChange={e => setType(e.target.value)}
                  className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand">
                  {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Available variable pills */}
            <div>
              <p className="text-xs font-500 text-ink-secondary mb-1.5">Variables disponibles</p>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARS.map(v => (
                  <VariablePill key={v} name={v} onClick={() => insertVar(v)} />
                ))}
              </div>
              <p className="text-2xs text-ink-tertiary mt-1">Click para insertar en el cuerpo del mensaje</p>
            </div>

            {/* Body + preview toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-500 text-ink-secondary">Cuerpo del mensaje</label>
                <button
                  type="button"
                  onClick={() => setPreview(p => !p)}
                  className={clsx(
                    'flex items-center gap-1 text-xs transition-colors',
                    preview ? 'text-brand' : 'text-ink-tertiary hover:text-ink'
                  )}
                >
                  <Eye className="w-3 h-3" /> {preview ? 'Editar' : 'Vista previa'}
                </button>
              </div>

              {preview ? (
                <div className="min-h-[120px] px-3 py-2.5 bg-surface-subtle border border-surface-border rounded-lg text-sm text-ink whitespace-pre-wrap">
                  {previewText || <span className="text-ink-tertiary italic">El mensaje aparecerá aquí…</span>}
                </div>
              ) : (
                <textarea disabled={acting}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={6}
                  required
                  placeholder={`Hola {{nombre}}, te recordamos que tu póliza de {{ramo}} vence el {{fecha_vencimiento}}.\n\nQuedamos a disposición.\n— {{productor}}`}
                  className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand font-mono"
                />
              )}

              {/* Variables detected in body */}
              {usedVars.length > 0 && (
                <p className="text-2xs text-ink-tertiary mt-1">
                  Variables detectadas: {usedVars.map(v => `{{${v}}}`).join(', ')}
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-4 py-3 border-t border-surface-border shrink-0">
            <Button type="submit" variant="primary" size="md" loading={acting}
              disabled={!name.trim() || !body.trim()} className="flex-1">
              {templateId ? 'Guardar cambios' : 'Crear template'}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
