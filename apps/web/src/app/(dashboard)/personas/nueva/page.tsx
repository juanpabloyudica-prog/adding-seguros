'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createPerson } from '@/lib/api/persons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useToast } from '@/components/ui/Toast'

const DOC_TYPES = ['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'otro'] as const
type DocType = typeof DOC_TYPES[number]

export default function NuevaPersonaPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [fullName,   setFullName]   = useState('')
  const [phone,      setPhone]      = useState('')
  const [email,      setEmail]      = useState('')
  const [docType,    setDocType]    = useState<DocType | ''>('')
  const [docNumber,  setDocNumber]  = useState('')
  const [address,    setAddress]    = useState('')
  const [notes,      setNotes]      = useState('')
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!fullName.trim()) e.fullName = 'El nombre es obligatorio'
    if (fullName.trim().length < 2) e.fullName = 'El nombre debe tener al menos 2 caracteres'
    if (phone && !/^\+?[\d\s\-().]+$/.test(phone)) e.phone = 'Formato de teléfono inválido'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email inválido'
    if (docType && !docNumber.trim()) e.docNumber = `Ingresá el número de ${docType}`
    if (!docType && docNumber.trim()) e.docType = 'Seleccioná el tipo de documento'
    return e
  }

  const handleSubmit = async () => {
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitting(true)
    setServerError(null)
    try {
      const result = await createPerson(
        {
          full_name:  fullName.trim(),
          phone:      phone.trim()     || undefined,
          email:      email.trim()     || undefined,
          doc_type:   docType          || undefined,
          doc_number: docNumber.trim() || undefined,
          address:    address.trim()   || undefined,
          notes:      notes.trim()     || undefined,
        },
        `new-person-${Date.now()}`
      )
      success('Persona creada', fullName.trim())
      router.push(`/personas/${result.data.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear la persona'
      setServerError(msg)
      toastError('No se pudo crear la persona', msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/personas"
          className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-600 text-ink">Nueva persona</h1>
          <p className="text-xs text-ink-tertiary">Personas / <span className="text-ink">Nueva</span></p>
        </div>
      </div>

      <div className="card p-5 space-y-4">

        {/* Nombre — required */}
        <div>
          <Input
            label="Nombre completo *"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ej: García, Juan Carlos"
            error={errors.fullName}
            autoFocus
          />
        </div>

        {/* Documento */}
        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-2">
            <label className="text-xs font-500 text-ink-secondary block mb-1">Tipo de doc.</label>
            <select
              value={docType}
              onChange={e => setDocType(e.target.value as DocType | '')}
              className="w-full h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">—</option>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.docType && <p className="text-xs text-danger mt-1">{errors.docType}</p>}
          </div>
          <div className="col-span-3">
            <Input
              label="Número"
              value={docNumber}
              onChange={e => setDocNumber(e.target.value)}
              placeholder="Ej: 28.456.789"
              error={errors.docNumber}
              disabled={!docType}
            />
          </div>
        </div>

        {/* Contacto */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Teléfono"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+54 11 1234-5678"
            error={errors.phone}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="juan@email.com"
            error={errors.email}
          />
        </div>

        {/* Dirección */}
        <Input
          label="Dirección"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Ej: Av. Corrientes 1234, CABA"
        />

        {/* Notas */}
        <div>
          <label className="text-xs font-500 text-ink-secondary block mb-1">Notas internas</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Información adicional relevante para el equipo…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface resize-none focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {serverError && <ErrorAlert message={serverError} title="No se pudo crear la persona" />}

        <div className="flex gap-2 pt-1">
          <Button
            variant="primary" size="md" loading={submitting}
            onClick={handleSubmit} className="flex-1"
          >
            Crear persona
          </Button>
          <Button variant="secondary" size="md" onClick={() => router.push('/personas')}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}
