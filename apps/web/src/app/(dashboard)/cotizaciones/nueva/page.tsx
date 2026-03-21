'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, User, Tag, ChevronRight, Plus, Loader2 } from 'lucide-react'
import { getPersons } from '@/lib/api/persons'
import { getRisksByPerson, type Risk } from '@/lib/api/risks'
import { createQuote } from '@/lib/api/quotes'
import { getProducers, type ProducerListItem } from '@/lib/api/producers'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'

// ─── Risk type labels ─────────────────────────────────────────────────────────
const RISK_TYPE_LABELS: Record<string, string> = {
  auto:            'Auto',
  moto:            'Moto',
  hogar:           'Hogar',
  vida:            'Vida',
  accidentes:      'Accidentes personales',
  comercial:       'Comercial',
  transporte:      'Transporte',
  responsabilidad: 'Responsabilidad civil',
  otros:           'Otros',
}

function riskDescription(risk: Risk): string {
  const d = risk.data
  const parts = [
    RISK_TYPE_LABELS[risk.type] ?? risk.type,
    d['marca'] && d['modelo'] ? `${d['marca']} ${d['modelo']}` : null,
    d['anio'] ? String(d['anio']) : null,
    d['patente'] ? String(d['patente']) : null,
    d['direccion'] ? String(d['direccion']) : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

// ─── Person search ────────────────────────────────────────────────────────────
interface PersonResult {
  id: string
  full_name: string
  phone: string | null
  doc_number: string | null
}

function PersonSearch({
  onSelect,
}: {
  onSelect: (p: PersonResult) => void
}) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<PersonResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await getPersons({ search: q, limit: 8 })
        setResults(res.data.map(p => ({
          id:         p.id,
          full_name:  p.full_name,
          phone:      p.phone ?? null,
          doc_number: p.doc_number ?? null,
        })))
        setOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
  }, [])

  return (
    <div className="relative">
      <Input
        placeholder="Buscar por nombre, DNI o teléfono…"
        value={query}
        onChange={e => { setQuery(e.target.value); search(e.target.value) }}
        icon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        autoFocus
      />
      {open && results.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 z-20 card shadow-dropdown py-1 animate-fade-in">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => { onSelect(p); setQuery(p.full_name); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 hover:bg-surface-subtle transition-colors flex items-center gap-3"
              >
                <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center text-xs font-600 text-brand shrink-0">
                  {p.full_name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-500 text-ink">{p.full_name}</p>
                  <p className="text-xs text-ink-tertiary">
                    {[p.doc_number, p.phone].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-ink-tertiary ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 card shadow-dropdown px-4 py-3 animate-fade-in">
          <p className="text-sm text-ink-tertiary">Sin resultados para "{query}"</p>
        </div>
      )}
    </div>
  )
}

// ─── Risk selector ────────────────────────────────────────────────────────────
function RiskSelector({
  personId,
  onSelect,
  selected,
}: {
  personId: string
  onSelect: (r: Risk | null) => void
  selected: Risk | null
}) {
  const [risks,   setRisks]   = useState<Risk[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRisksByPerson(personId)
      .then(r => setRisks(r.data))
      .catch(() => setRisks([]))
      .finally(() => setLoading(false))
  }, [personId])

  if (loading) return (
    <div className="space-y-2">
      <Skeleton className="h-14 rounded-lg" />
      <Skeleton className="h-14 rounded-lg" />
    </div>
  )

  if (risks.length === 0) return (
    <div className="rounded-lg border border-dashed border-surface-border px-4 py-5 text-center">
      <Tag className="w-5 h-5 text-ink-tertiary mx-auto mb-2" />
      <p className="text-sm text-ink-secondary font-500">Sin riesgos registrados</p>
      <p className="text-xs text-ink-tertiary mt-1">
        Agregá un riesgo desde el perfil de la persona antes de cotizar.
      </p>
    </div>
  )

  return (
    <div className="space-y-2">
      {risks.map(r => (
        <label
          key={r.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            selected?.id === r.id
              ? 'border-brand bg-brand/5'
              : 'border-surface-border hover:bg-surface-subtle'
          }`}
        >
          <input
            type="radio"
            name="risk"
            value={r.id}
            checked={selected?.id === r.id}
            onChange={() => onSelect(r)}
            className="accent-brand shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-500 text-ink">{riskDescription(r)}</p>
            <p className="text-2xs text-ink-tertiary uppercase tracking-wide mt-0.5">
              {RISK_TYPE_LABELS[r.type] ?? r.type}
            </p>
          </div>
        </label>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NuevaCotizacionPage() {
  const router = useRouter()

  const [step,         setStep]         = useState<'persona' | 'riesgo' | 'datos'>('persona')
  const [person,       setPerson]       = useState<PersonResult | null>(null)
  const [risk,         setRisk]         = useState<Risk | null>(null)
  const [producerId,   setProducerId]   = useState<string>('')
  const [producers,    setProducers]    = useState<ProducerListItem[]>([])
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const { error: toastError } = useToast()

  // Load producers once (needed in step 3)
  useEffect(() => {
    getProducers({ is_active: true })
      .then(r => setProducers(r.data))
      .catch(() => {})
  }, [])

  const handlePersonSelect = (p: PersonResult) => {
    setPerson(p)
    setRisk(null)
    setStep('riesgo')
  }

  const handleSubmit = async () => {
    if (!person || !risk) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await createQuote(
        {
          person_id:   person.id,
          risk_id:     risk.id,
          producer_id: producerId || undefined,
          notes:       notes.trim() || undefined,
        },
        `new-quote-${Date.now()}`
      )
      router.push(`/cotizaciones/${result.data.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear cotización'
      setError(msg)
      toastError('No se pudo crear la cotización', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const STEPS = [
    { id: 'persona', label: 'Persona' },
    { id: 'riesgo',  label: 'Riesgo'  },
    { id: 'datos',   label: 'Detalles'},
  ] as const

  return (
    <div className="max-w-xl space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cotizaciones"
          className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-600 text-ink">Nueva cotización</h1>
          <p className="text-xs text-ink-tertiary">
            Cotizaciones / <span className="text-ink">Nueva</span>
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isDone    = STEPS.findIndex(x => x.id === step) > i
          const isCurrent = s.id === step
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs font-500 ${
                isCurrent ? 'text-brand' : isDone ? 'text-success' : 'text-ink-tertiary'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-600 ${
                  isCurrent ? 'bg-brand text-white' :
                  isDone    ? 'bg-success text-white' :
                              'bg-surface-muted text-ink-tertiary'
                }`}>
                  {i + 1}
                </span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-8 ${isDone ? 'bg-success' : 'bg-surface-border'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="card p-5 space-y-4">

        {/* ── Step 1: Person ───────────────────────────────────────── */}
        {step === 'persona' && (
          <>
            <div>
              <p className="text-sm font-600 text-ink mb-1">¿Para quién es la cotización?</p>
              <p className="text-xs text-ink-tertiary mb-3">Buscá la persona por nombre, DNI o teléfono.</p>
              <PersonSearch onSelect={handlePersonSelect} />
            </div>
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-ink-tertiary">
                ¿La persona no está registrada?{' '}
                <Link href="/personas" className="text-brand hover:underline">
                  Creala desde el módulo Personas
                </Link>
              </p>
            </div>
          </>
        )}

        {/* ── Step 2: Risk ─────────────────────────────────────────── */}
        {step === 'riesgo' && person && (
          <>
            <div className="flex items-center gap-2 p-3 bg-surface-subtle rounded-lg border border-surface-border">
              <User className="w-4 h-4 text-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-ink">{person.full_name}</p>
                {person.phone && <p className="text-xs text-ink-tertiary">{person.phone}</p>}
              </div>
              <button onClick={() => setStep('persona')}
                className="text-xs text-ink-tertiary hover:text-brand transition-colors shrink-0">
                Cambiar
              </button>
            </div>

            <div>
              <p className="text-sm font-600 text-ink mb-1">¿Qué riesgo querés cotizar?</p>
              <p className="text-xs text-ink-tertiary mb-3">
                Seleccioná el riesgo vinculado a esta persona.
              </p>
              <RiskSelector
                personId={person.id}
                selected={risk}
                onSelect={r => { setRisk(r); if (r) setStep('datos') }}
              />
            </div>
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-ink-tertiary">
                ¿Riesgo no está en la lista?{' '}
                <Link href={`/personas/${person.id}`} className="text-brand hover:underline">
                  Agregalo desde el perfil de la persona
                </Link>
              </p>
            </div>
          </>
        )}

        {/* ── Step 3: Notes + confirm ───────────────────────────────── */}
        {step === 'datos' && person && risk && (
          <>
            {/* Summary */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 bg-surface-subtle rounded-lg border border-surface-border">
                <User className="w-4 h-4 text-brand shrink-0" />
                <p className="text-sm font-500 text-ink flex-1">{person.full_name}</p>
                <button onClick={() => setStep('persona')}
                  className="text-xs text-ink-tertiary hover:text-brand shrink-0">Cambiar</button>
              </div>
              <div className="flex items-center gap-2 p-3 bg-surface-subtle rounded-lg border border-surface-border">
                <Tag className="w-4 h-4 text-ink-tertiary shrink-0" />
                <p className="text-sm text-ink flex-1">{riskDescription(risk)}</p>
                <button onClick={() => setStep('riesgo')}
                  className="text-xs text-ink-tertiary hover:text-brand shrink-0">Cambiar</button>
              </div>
            </div>

            {/* Producer */}
            {producers.length > 0 && (
              <div>
                <label className="text-xs font-500 text-ink-secondary block mb-1">
                  Productor (opcional)
                </label>
                <select
                  value={producerId}
                  onChange={e => setProducerId(e.target.value)}
                  className="w-full h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Sin productor asignado</option>
                  {producers.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.user.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-500 text-ink-secondary block mb-1">
                Notas internas (opcional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contexto para el equipo: preferencias del cliente, restricciones, etc."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {error && <ErrorAlert message={error} />}

            <div className="flex gap-2 pt-1">
              <Button
                variant="primary"
                size="md"
                loading={submitting}
                onClick={handleSubmit}
                icon={<Plus className="w-4 h-4" />}
                className="flex-1"
              >
                Crear cotización
              </Button>
              <Button variant="secondary" size="md" onClick={() => router.push('/cotizaciones')}>
                Cancelar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
