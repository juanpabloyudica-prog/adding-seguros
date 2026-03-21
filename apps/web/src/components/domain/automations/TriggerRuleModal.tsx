'use client'

import { useState, useEffect } from 'react'
import { X, Zap, Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { resolveTemplate, extractTemplateVariables } from '@adding/utils'
import { useRules, useTemplates } from '@/hooks/useAutomations'
import { triggerRule } from '@/lib/api/automations'
import type { RuleDetail, Template } from '@/lib/api/automations'
import { TRIGGER_EVENT_LABELS } from '@adding/types'

interface TriggerRuleModalProps {
  // Pre-filled context
  conversationId:  string
  personName?:     string | null
  policyId?:       string
  caseId?:         string
  // Pre-fill variables
  variables?: Record<string, string>
  // Filter rules by trigger type
  triggerEventFilter?: string[]
  onClose:   () => void
  onSuccess?: () => void
}

export function TriggerRuleModal({
  conversationId, personName, policyId, caseId,
  variables: initialVars = {}, triggerEventFilter,
  onClose, onSuccess,
}: TriggerRuleModalProps) {
  const { data: rules,     loading: rulesLoading }     = useRules()
  const { data: templates, loading: templatesLoading } = useTemplates()

  const [selectedRule, setSelectedRule] = useState<RuleDetail | null>(null)
  const [vars, setVars]                 = useState<Record<string, string>>(initialVars)
  const [sendNow, setSendNow]           = useState(true)
  const [sending, setSending]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState(false)
  const [preview, setPreview]           = useState('')

  // Filter rules
  const eligibleRules = (rules ?? []).filter(r =>
    r.is_active &&
    (!triggerEventFilter || triggerEventFilter.includes(r.trigger_event))
  )

  // Update preview when rule or vars change
  useEffect(() => {
    if (!selectedRule?.template) { setPreview(''); return }
    const resolved = resolveTemplate(selectedRule.template.body, vars)
    setPreview(resolved)
  }, [selectedRule, vars])

  // Auto-fill detected variables
  useEffect(() => {
    if (!selectedRule?.template) return
    const detected = extractTemplateVariables(selectedRule.template.body)
    const filled = { ...initialVars }
    if (personName && detected.includes('nombre')) filled['nombre'] = personName
    setVars(filled)
  }, [selectedRule, initialVars, personName])

  const handleSend = async () => {
    if (!selectedRule) return
    setSending(true); setError(null)
    try {
      await triggerRule({
        rule_id: selectedRule.id,
        conversation_id: conversationId,
        policy_id: policyId,
        case_id: caseId,
        variables: vars,
        send_now: sendNow,
      })
      setDone(true)
      setTimeout(() => { onSuccess?.(); onClose() }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al disparar regla')
    } finally { setSending(false) }
  }

  const templateVars = selectedRule?.template
    ? extractTemplateVariables(selectedRule.template.body)
    : []

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-surface rounded-xl w-full max-w-md shadow-dropdown animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-600">Disparar mensaje automático</h2>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink"><X className="w-4 h-4" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8 px-4">
            <CheckCircle2 className="w-10 h-10 text-success" />
            <p className="text-sm font-500 text-ink">
              {sendNow ? 'Mensaje enviado' : 'Mensaje programado'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Context chip */}
            {personName && (
              <div className="text-2xs bg-brand/10 text-brand px-2 py-1 rounded-full font-500 w-fit">
                👤 {personName}
              </div>
            )}

            {/* Rule selector */}
            {rulesLoading ? (
              <p className="text-sm text-ink-tertiary">Cargando reglas…</p>
            ) : eligibleRules.length === 0 ? (
              <p className="text-sm text-ink-tertiary">
                No hay reglas activas disponibles.{' '}
                <a href="/automatizaciones" className="text-brand underline">Crear una regla</a>
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-500 text-ink-secondary">Regla a disparar</label>
                <div className="space-y-1.5">
                  {eligibleRules.map(rule => (
                    <label key={rule.id} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                      selectedRule?.id === rule.id
                        ? 'border-brand bg-brand/5'
                        : 'border-surface-border hover:bg-surface-subtle'
                    }`}>
                      <input type="radio" name="rule" className="accent-brand mt-0.5"
                        checked={selectedRule?.id === rule.id}
                        onChange={() => setSelectedRule(rule)} />
                      <div className="min-w-0">
                        <p className="text-sm font-500 text-ink">{rule.name}</p>
                        <p className="text-2xs text-ink-tertiary">
                          {TRIGGER_EVENT_LABELS[rule.trigger_event as keyof typeof TRIGGER_EVENT_LABELS] ?? rule.trigger_event}
                          {rule.delay_hours > 0 && ` · ${rule.delay_hours}h demora`}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Variables */}
            {templateVars.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-500 text-ink-secondary">Variables del mensaje</p>
                {templateVars.map(v => (
                  <div key={v} className="flex items-center gap-2">
                    <span className="text-2xs font-mono text-brand w-32 shrink-0">{`{{${v}}}`}</span>
                    <input
                      type="text"
                      value={vars[v] ?? ''}
                      onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))}
                      placeholder={`Valor para ${v}…`}
                      className="flex-1 h-8 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Preview */}
            {preview && (
              <div className="bg-surface-subtle border border-surface-border rounded-lg px-3 py-2.5">
                <p className="text-2xs text-ink-tertiary font-500 mb-1">Vista previa</p>
                <p className="text-sm text-ink whitespace-pre-wrap">{preview}</p>
              </div>
            )}

            {/* Send now vs schedule */}
            {selectedRule && (
              <div className="flex items-center gap-3 py-2 border-t border-surface-border">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)}
                    className="accent-brand" />
                  <span className="text-sm text-ink">Enviar ahora</span>
                </label>
                {!sendNow && selectedRule.delay_hours > 0 && (
                  <span className="text-xs text-ink-tertiary">
                    Se programará para {selectedRule.delay_hours}h desde ahora
                  </span>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="md" loading={sending}
                disabled={!selectedRule}
                onClick={handleSend}
                icon={<Send className="w-3.5 h-3.5" />}
                className="flex-1">
                {sendNow ? 'Enviar ahora' : 'Programar'}
              </Button>
              <Button variant="secondary" size="md" onClick={onClose}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
