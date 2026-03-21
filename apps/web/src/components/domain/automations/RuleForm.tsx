'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TRIGGER_EVENTS, TRIGGER_EVENT_LABELS } from '@adding/types'
import type { Template } from '@/lib/api/automations'

interface RuleFormProps {
  ruleId?:   string
  initial?: {
    name?: string; template_id?: string; trigger_event?: string
    delay_hours?: number; recurrence_days?: number | null; is_active?: boolean
    filter_ramo?: string | null; cancel_on_events?: string[]
  }
  templates: Template[]
  onSave:    (data: Record<string, unknown>, id?: string) => Promise<unknown>
  onClose:   () => void
  acting:    boolean
  error:     string | null
}

const CANCEL_ON_OPTIONS = [
  { value: 'policy_renewed',   label: 'Póliza renovada'     },
  { value: 'case_closed',      label: 'Caso cerrado'        },
  { value: 'quote_selected',   label: 'Cotización elegida'  },
  { value: 'manual_response',  label: 'Respuesta manual'    },
]

export function RuleForm({ ruleId, initial, templates, onSave, onClose, acting, error }: RuleFormProps) {
  const [name,        setName]        = useState(initial?.name ?? '')
  const [templateId,  setTemplateId]  = useState(initial?.template_id ?? '')
  const [trigger,     setTrigger]     = useState(initial?.trigger_event ?? TRIGGER_EVENTS[0])
  const [delayHours,  setDelayHours]  = useState(initial?.delay_hours ?? 0)
  const [recurrence,  setRecurrence]  = useState<string>(initial?.recurrence_days?.toString() ?? '')
  const [filterRamo,  setFilterRamo]  = useState(initial?.filter_ramo ?? '')
  const [cancelOn,    setCancelOn]    = useState<Set<string>>(new Set(initial?.cancel_on_events ?? []))

  const toggleCancel = (v: string) =>
    setCancelOn(prev => { const s = new Set(prev); s.has(v) ? s.delete(v) : s.add(v); return s })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({
      name: name.trim(),
      template_id: templateId,
      trigger_event: trigger,
      delay_hours: Number(delayHours),
      recurrence_days: recurrence ? Number(recurrence) : null,
      filter_ramo: filterRamo.trim() || null,
      cancel_on_events: [...cancelOn],
    }, ruleId)
  }

  // Selected template preview
  const selectedTemplate = templates.find(t => t.id === templateId)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface rounded-xl w-full max-w-lg max-h-[90dvh] flex flex-col shadow-dropdown animate-fade-in">

        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border shrink-0">
          <h2 className="text-sm font-600">{ruleId ? 'Editar regla' : 'Nueva regla de automatización'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            <Input disabled={acting}
              label="Nombre de la regla"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Ej: Recordatorio 7 días antes del vencimiento"
            />

            {/* Trigger */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-500 text-ink-secondary">Disparador</label>
              <select disabled={acting} value={trigger} onChange={e => setTrigger(e.target.value)}
                className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand">
                {TRIGGER_EVENTS.map(t => (
                  <option key={t} value={t}>{TRIGGER_EVENT_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Template */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-500 text-ink-secondary">Template de mensaje</label>
              <select disabled={acting} value={templateId} onChange={e => setTemplateId(e.target.value)} required
                className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="">Seleccionar template…</option>
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTemplate && (
                <p className="text-2xs text-ink-tertiary bg-surface-subtle rounded px-2 py-1 mt-1 font-mono line-clamp-2">
                  {selectedTemplate.body.slice(0, 100)}…
                </p>
              )}
            </div>

            {/* Delay */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-500 text-ink-secondary">Demora (horas)</label>
                <input disabled={acting}
                  type="number" min={0} max={720} value={delayHours}
                  onChange={e => setDelayHours(Number(e.target.value))}
                  className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="text-2xs text-ink-tertiary">0 = inmediato al dispararse</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-500 text-ink-secondary">Repetir cada (días)</label>
                <input disabled={acting}
                  type="number" min={1} max={365} placeholder="Sin repetición" value={recurrence}
                  onChange={e => setRecurrence(e.target.value)}
                  className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-500 text-ink-secondary">Filtrar por ramo (opcional)</label>
              <Input disabled={acting} placeholder="Ej: auto — dejar vacío para todos" value={filterRamo}
                onChange={e => setFilterRamo(e.target.value)} />
            </div>

            {/* Cancel on */}
            <div>
              <p className="text-xs font-500 text-ink-secondary mb-1.5">Cancelar automáticamente si ocurre:</p>
              <div className="space-y-1.5">
                {CANCEL_ON_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input disabled={acting} type="checkbox" checked={cancelOn.has(opt.value)}
                      onChange={() => toggleCancel(opt.value)} className="accent-brand" />
                    <span className="text-sm text-ink">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          <div className="flex gap-2 px-4 py-3 border-t border-surface-border shrink-0">
            <Button type="submit" variant="primary" size="md" loading={acting}
              disabled={!name.trim() || !templateId} className="flex-1">
              {ruleId ? 'Guardar cambios' : 'Crear regla'}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
