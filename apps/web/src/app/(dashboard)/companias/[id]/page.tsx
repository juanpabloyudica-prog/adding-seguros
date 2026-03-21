'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ExternalLink, Edit2, Check, X,
  Shield, FileText, Star, Building2, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { getCompany, updateCompany } from '@/lib/api/companies'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import type { CompanyDetail } from '@/lib/api/companies'
import { Badge } from '@/components/ui/Badge'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Button } from '@/components/ui/Button'

// ─── Star ranking ──────────────────────────────────────────────────────────────
function RankingStars({ n, editable, onChange }: {
  n: number | null; editable?: boolean; onChange?: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button"
          disabled={!editable}
          onClick={() => editable && onChange?.(i + 1)}
          className={editable ? 'cursor-pointer' : 'cursor-default'}>
          <Star className={`w-4 h-4 ${i < (n ?? 0)
            ? 'text-warning fill-warning'
            : 'text-surface-border'
          }`} />
        </button>
      ))}
    </div>

      {confirmToggle && (
        <ConfirmDialog
          title={company.is_active ? '¿Desactivar compañía?' : '¿Activar compañía?'}
          description={company.is_active
            ? `Desactivar ${company.name} la ocultará de nuevas cotizaciones. Las pólizas existentes no se ven afectadas.`
            : `Activar ${company.name} la hará disponible nuevamente para cotizaciones.`}
          confirmLabel={company.is_active ? 'Desactivar' : 'Activar'}
          variant={company.is_active ? 'danger' : 'default'}
          loading={saving}
          onConfirm={async () => { await handleSave('is_active', !company.is_active); setConfirmToggle(false) }}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
    </div>
  )
}

// ─── Editable URL field ───────────────────────────────────────────────────────
function UrlField({
  label, value, field, onSave, saving,
}: {
  label: string
  value: string | null
  field: string
  onSave: (field: string, val: string | null) => Promise<void>
  saving: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')

  const handleSave = async () => {
    await onSave(field, draft.trim() || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="https://..."
          className="flex-1 h-8 px-2.5 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
        <button onClick={handleSave} disabled={saving}
          className="p-1 text-success hover:bg-success-bg rounded transition-colors">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => { setDraft(value ?? ''); setEditing(false) }}
          className="p-1 text-ink-tertiary hover:text-ink rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      {value ? (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-sm text-brand hover:underline flex items-center gap-1 truncate">
          {value.replace(/^https?:\/\//, '')}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      ) : (
        <span className="text-sm text-ink-tertiary italic">Sin configurar</span>
      )}
      <button onClick={() => setEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 text-ink-tertiary hover:text-brand transition-all rounded">
        <Edit2 className="w-3 h-3" />
      </button>
    </div>

      {confirmToggle && (
        <ConfirmDialog
          title={company.is_active ? '¿Desactivar compañía?' : '¿Activar compañía?'}
          description={company.is_active
            ? `Desactivar ${company.name} la ocultará de nuevas cotizaciones. Las pólizas existentes no se ven afectadas.`
            : `Activar ${company.name} la hará disponible nuevamente para cotizaciones.`}
          confirmLabel={company.is_active ? 'Desactivar' : 'Activar'}
          variant={company.is_active ? 'danger' : 'default'}
          loading={saving}
          onConfirm={async () => { await handleSave('is_active', !company.is_active); setConfirmToggle(false) }}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const [company, setCompany] = useState<CompanyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCompany((await getCompany(id)).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error al cargar compañía') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSave = async (field: string, value: unknown) => {
    setSaving(true); setSaveError(null)
    try {
      const updated = (await updateCompany(id, { [field]: value } as Record<string, unknown>)).data
      setCompany(prev => prev ? { ...prev, ...updated } : prev)
      toastSuccess('Cambio guardado')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar el cambio'
      setSaveError(msg)
      toastError('No se pudo guardar', msg)
    } finally { setSaving(false) }
  }

  if (loading) return (
    <div className="space-y-4 max-w-2xl">
      <Skeleton className="h-8 w-48 rounded" />
      <CardSkeleton rows={6} />
    </div>
  )

  if (error) return (
    <div className="max-w-2xl space-y-3">
      <Link href="/companias" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft className="w-3.5 h-3.5" /> Compañías
      </Link>
      <ErrorAlert message={error} />
    </div>
  )

  if (!company) return null

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-tertiary">
        <Link href="/companias" className="hover:text-brand transition-colors font-500">Compañías</Link>
        <span>/</span>
        <span className="text-ink">{company.name}</span>
      </nav>

      {/* Header card */}
      <div className="card px-4 py-4">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="w-14 h-14 rounded-xl bg-surface-muted border border-surface-border flex items-center justify-center shrink-0 overflow-hidden">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
            ) : (
              <Building2 className="w-6 h-6 text-ink-tertiary" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-700 text-ink">{company.name}</h1>
              {company.short_name && (
                <span className="text-sm text-ink-tertiary">({company.short_name})</span>
              )}
              <Badge variant={company.is_active ? 'success' : 'muted'}>
                {company.is_active ? 'Activa' : 'Inactiva'}
              </Badge>
              {company.multicotizador && (
                <Badge variant="info" className="text-2xs">Multicotizador</Badge>
              )}
            </div>

            {/* Ranking */}
            <div className="flex items-center gap-2 mt-2">
              <RankingStars n={company.ranking} editable={true}
                onChange={v => handleSave('ranking', v)} />
              <span className="text-xs text-ink-tertiary">
                {company.ranking ? `${company.ranking}/5` : 'Sin ranking'}
              </span>
            </div>
          </div>

          {/* Toggle active */}
          <button
            onClick={() => setConfirmToggle(true)}
            disabled={saving}
            title={company.is_active ? 'Desactivar' : 'Activar'}
          >
            {company.is_active
              ? <ToggleRight className="w-6 h-6 text-brand" />
              : <ToggleLeft className="w-6 h-6 text-ink-tertiary" />
            }
          </button>
        </div>
      </div>

      {saveError && <ErrorAlert message={saveError} />}

      {/* Metadata counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-3 flex items-center gap-3">
          <Shield className="w-4 h-4 text-brand shrink-0" />
          <div>
            <p className="text-xl font-600 text-ink tabular-nums">
              {company.metadata.active_policy_count}
            </p>
            <p className="text-xs text-ink-tertiary">Pólizas activas</p>
          </div>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <FileText className="w-4 h-4 text-ink-secondary shrink-0" />
          <div>
            <p className="text-xl font-600 text-ink tabular-nums">
              {company.metadata.quote_option_count}
            </p>
            <p className="text-xs text-ink-tertiary">Opciones cotizadas</p>
          </div>
        </div>
      </div>

      {/* Operational links */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border bg-surface-subtle">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">Links operativos</p>
        </div>
        <div className="px-4 py-3 space-y-3">
          {[
            { label: 'Login / Portal',      field: 'login_url',          value: company.login_url },
            { label: 'Emisión',             field: 'emision_url',         value: company.emision_url },
            { label: 'Siniestros',          field: 'siniestros_url',      value: company.siniestros_url },
            { label: 'Consulta de póliza',  field: 'consulta_poliza_url', value: company.consulta_poliza_url },
          ].map(({ label, field, value }) => (
            <div key={field} className="flex items-start gap-3">
              <p className="text-xs text-ink-tertiary w-36 shrink-0 pt-0.5">{label}</p>
              <div className="flex-1 min-w-0">
                <UrlField label={label} value={value} field={field}
                  onSave={handleSave} saving={saving} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {company.notes && (
        <div className="card px-4 py-3">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-1">Notas</p>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{company.notes}</p>
        </div>
      )}

      {/* Quick links */}
      <div className="flex gap-2 flex-wrap">
        <Link href={`/polizas?company_id=${id}`}
          className="text-xs text-brand hover:underline flex items-center gap-1">
          <Shield className="w-3 h-3" /> Ver pólizas de esta compañía
        </Link>
        <Link href={`/cotizaciones?company_id=${id}`}
          className="text-xs text-ink-secondary hover:text-ink hover:underline flex items-center gap-1">
          <FileText className="w-3 h-3" /> Ver cotizaciones
        </Link>
      </div>
    </div>

      {confirmToggle && (
        <ConfirmDialog
          title={company.is_active ? '¿Desactivar compañía?' : '¿Activar compañía?'}
          description={company.is_active
            ? `Desactivar ${company.name} la ocultará de nuevas cotizaciones. Las pólizas existentes no se ven afectadas.`
            : `Activar ${company.name} la hará disponible nuevamente para cotizaciones.`}
          confirmLabel={company.is_active ? 'Desactivar' : 'Activar'}
          variant={company.is_active ? 'danger' : 'default'}
          loading={saving}
          onConfirm={async () => { await handleSave('is_active', !company.is_active); setConfirmToggle(false) }}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
    </div>
  )
}
