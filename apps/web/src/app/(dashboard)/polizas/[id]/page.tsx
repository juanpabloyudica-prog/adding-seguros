'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, User, Building2,
  RefreshCw, ChevronDown, FileText, Tag} from 'lucide-react'
import { clsx } from 'clsx'
import { usePolicyDetail, usePolicyActions } from '@/hooks/usePolicies'
import { useToast } from '@/components/ui/Toast'
import { useCurrentUser } from '@/hooks/useConversations'
import { PolicyStatusBadge } from '@/components/domain/policies/PolicyStatusBadge'
import { DocumentUploader } from '@/components/domain/documents/DocumentUploader'
import { DocumentList } from '@/components/domain/documents/DocumentList'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'
import { Button } from '@/components/ui/Button'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Badge } from '@/components/ui/Badge'
import { getDocuments } from '@/lib/api/documents'
import type { Document } from '@/lib/api/documents'
import { useEffect } from 'react'
import { formatCurrency } from '@adding/utils'

const PAYMENT_FREQ_LABELS: Record<string, string> = {
  monthly:     'Mensual',
  quarterly:   'Trimestral',
  semi_annual: 'Semestral',
  annual:      'Anual'}

const RENEWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  quoted:  'Cotizada',
  renewed: 'Renovada',
  lost:    'Perdida'}

const RISK_TYPE_LABELS: Record<string, string> = {
  auto: 'Auto', moto: 'Moto', hogar: 'Hogar', vida: 'Vida',
  accidentes: 'Accidentes', comercial: 'Comercial',
  transporte: 'Transporte', responsabilidad: 'Resp. Civil', otros: 'Otros'}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function InfoRow({ label, value, mono = false }: {
  label: string; value: React.ReactNode; mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-surface-border last:border-0">
      <p className="text-xs text-ink-tertiary shrink-0 pt-0.5">{label}</p>
      <p className={clsx('text-sm text-ink text-right', mono && 'font-mono')}>{value ?? '—'}</p>
    </div>
  )
}

// ─── Renew modal ──────────────────────────────────────────────────────────────
function RenewModal({
  policyNumber, ramo, onConfirm, onCancel, acting}: {
  policyNumber: string; ramo: string
  onConfirm: (data: Record<string, string>) => void
  onCancel: () => void; acting: boolean
}) {
  const [policyNum,   setPolicyNum]   = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,     setEndDate]     = useState('')
  const [premium,     setPremium]     = useState('')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface rounded-xl w-full max-w-sm shadow-dropdown animate-fade-in p-4 space-y-3">
        <p className="text-sm font-600 text-ink">Renovar póliza</p>
        <p className="text-xs text-ink-tertiary">
          Ramo: <span className="font-500">{ramo}</span> · Número anterior: <span className="font-mono">{policyNumber}</span>
        </p>
        <div className="space-y-2">
          <input value={policyNum} onChange={e => setPolicyNum(e.target.value)}
            placeholder="Nuevo número de póliza"
            className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-2xs text-ink-tertiary">Inicio</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="text-2xs text-ink-tertiary">Fin</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full h-9 px-2 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <input value={premium} onChange={e => setPremium(e.target.value)}
            placeholder="Nueva prima (ej: 45000)"
            type="number" min="0"
            className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" loading={acting}
            disabled={!policyNum.trim() || !startDate || !endDate}
            onClick={() => onConfirm({
              policy_number: policyNum.trim(),
              start_date: startDate,
              end_date: endDate,
              ...(premium ? { premium } : {})})}
            className="flex-1">
            Renovar
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Status change dropdown ───────────────────────────────────────────────────
function StatusActions({
  status, onChangeStatus, acting}: {
  status: string
  onChangeStatus: (s: string, date?: string) => void
  acting: boolean
}) {
  const [open,       setOpen]    = useState(false)
  const [cancelDate, setCancelDate] = useState('')

  const TRANSITIONS: Record<string, { value: string; label: string; variant: 'default'|'danger'|'success' }[]> = {
    draft:  [
      { value: 'active',    label: 'Activar',   variant: 'success' },
      { value: 'cancelled', label: 'Cancelar',  variant: 'danger'  },
    ],
    active: [
      { value: 'expired',   label: 'Marcar vencida', variant: 'default' },
      { value: 'cancelled', label: 'Cancelar',        variant: 'danger'  },
    ]}

  const options = TRANSITIONS[status] ?? []
  if (!options.length) return null

  return (
    <div className="relative">
      <Button variant="secondary" size="sm"
        icon={<ChevronDown className="w-3.5 h-3.5" />}
        onClick={() => setOpen(o => !o)}
        loading={acting && open}>
        Cambiar estado
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 card shadow-dropdown py-1 min-w-[180px] animate-fade-in">
            {options.map(opt => (
              <button key={opt.value}
                disabled={acting}
                onClick={() => { onChangeStatus(opt.value, opt.value === 'cancelled' ? cancelDate || undefined : undefined); setOpen(false) }}
                className={clsx('w-full text-left px-3 py-2 text-sm transition-colors hover:bg-surface-subtle',
                  opt.variant === 'danger' && 'text-danger hover:bg-danger-bg',
                )}>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Risk display ──────────────────────────────────────────────────────────────
function RiskSummary({ type, data }: { type: string; data: Record<string, unknown> }) {
  const label = RISK_TYPE_LABELS[type] ?? type
  const details = [
    data['marca'] && data['modelo'] ? `${data['marca']} ${data['modelo']}` : null,
    data['anio'] ? String(data['anio']) : null,
    data['patente'] ? String(data['patente']) : null,
    data['direccion'] ? String(data['direccion']) : null,
  ].filter(Boolean)

  return (
    <div className="flex items-start gap-2">
      <Tag className="w-4 h-4 text-ink-tertiary shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-500 text-ink">{label}</p>
        {details.length > 0 && (
          <p className="text-xs text-ink-secondary">{details.join(' · ')}</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user: me } = useCurrentUser()

  const { data: policy, loading, error, refetch } = usePolicyDetail(id)
  const { changeStatus, renew, changeRenewalStatus, acting, error: actionError, clearError } =
    usePolicyActions(id, refetch)
  const { success: toastSuccess, error: toastError } = useToast()

  const [showRenew,    setShowRenew]    = useState(false)
  const [showNewCase,  setShowNewCase]  = useState(false)
  const [showUpload,   setShowUpload]   = useState(false)
  const [docs,         setDocs]         = useState<Document[]>([])
  const [docsLoading,  setDocsLoading]  = useState(true)

  useEffect(() => {
    getDocuments({ entity_type: 'policy', entity_id: id })
      .then(r => setDocs(r.data))
      .catch(() => {})
      .finally(() => setDocsLoading(false))
  }, [id])

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-48" />
      </div>
      <CardSkeleton rows={6} />
    </div>
  )

  if (error) return (
    <div className="max-w-2xl space-y-3">
      <Link href="/polizas" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft className="w-3.5 h-3.5" /> Pólizas
      </Link>
      <ErrorAlert message={error} />
    </div>
  )

  if (!policy) return null

  const isTerminal = ['expired', 'cancelled'].includes(policy.status)
  const canRenew   = policy.status === 'expired' || policy.computed_status === 'expiring'

  return (
    <div className="max-w-3xl space-y-4 animate-fade-in">

      {/* Modals */}
      {showRenew && (
        <RenewModal
          policyNumber={policy.policy_number}
          ramo={policy.ramo}
          onConfirm={async data => { const r = await renew(data); if (r) { toastSuccess('Póliza renovada correctamente'); setShowRenew(false) } }}
          onCancel={() => setShowRenew(false)}
          acting={acting}
        />
      )}
      {showNewCase && (
        <NewCaseModal
          personId={policy.person?.id}
          personName={policy.person?.full_name}
          policyId={id}
          policyNumber={policy.policy_number}
          onClose={() => setShowNewCase(false)}
        />
      )}

      {/* Breadcrumb + header */}
      <div className="space-y-2">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-ink-tertiary">
          <Link href='/polizas' className="hover:text-brand transition-colors font-500">
            Pólizas
          </Link>
          <span>/</span>
          <span className="text-ink font-mono truncate">{policy.policy_number}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-600 text-ink font-mono">{policy.policy_number}</h1>
                <PolicyStatusBadge status={policy.computed_status} />
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-ink-tertiary">
                {policy.person && (
                  <Link href={`/personas/${policy.person.id}`}
                    className="flex items-center gap-1 hover:text-brand transition-colors">
                    <User className="w-3 h-3" /> {policy.person.full_name}
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {policy.company?.short_name ?? policy.company?.name}
                </span>
                <span className="uppercase tracking-wide">{policy.ramo}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap shrink-0">
            {canRenew && (
              <Button variant="primary" size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={() => setShowRenew(true)}>
                Renovar
              </Button>
            )}
            {!isTerminal && (
              <StatusActions status={policy.status} onChangeStatus={changeStatus} acting={acting} />
            )}
            <Button variant="secondary" size="sm"
              icon={<FileText className="w-3.5 h-3.5" />}
              onClick={() => setShowNewCase(true)}>
              Nuevo caso
            </Button>
          </div>
        </div>
      </div>

      {actionError && <ErrorAlert message={actionError} onRetry={clearError} />}

      {/* Policy data */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-border bg-surface-subtle">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">Datos de la póliza</p>
        </div>
        <div className="px-4">
          <InfoRow label="Número" value={<span className="font-mono">{policy.policy_number}</span>} />
          {policy.endorsement_number && (
            <InfoRow label="Endoso" value={<span className="font-mono">{policy.endorsement_number}</span>} />
          )}
          <InfoRow label="Compañía" value={
            <span className="flex items-center gap-1.5 justify-end">
              <Building2 className="w-3.5 h-3.5 text-ink-tertiary" />
              {policy.company?.name}
            </span>
          } />
          <InfoRow label="Ramo" value={<span className="uppercase text-xs tracking-wide">{policy.ramo}</span>} />
          {policy.plan && <InfoRow label="Plan" value={policy.plan} />}
          <InfoRow label="Inicio de vigencia"   value={formatDate(policy.start_date)} />
          <InfoRow label="Fin de vigencia"       value={
            <span className={clsx(
              'flex items-center gap-1.5',
              policy.computed_status === 'expiring' ? 'text-warning font-500' :
              policy.computed_status === 'expired'  ? 'text-danger font-500'  : ''
            )}>
              {formatDate(policy.end_date)}
              {policy.computed_status === 'expiring' && (
                <Badge variant="warning" className="text-2xs">
                  {policy.days_until_expiry}d
                </Badge>
              )}
            </span>
          } />
          {policy.premium && (
            <InfoRow label="Prima" value={
              <span className="font-500">{formatCurrency(policy.premium, policy.currency)}</span>
            } />
          )}
          {policy.sum_insured && (
            <InfoRow label="Suma asegurada" value={formatCurrency(policy.sum_insured, policy.currency)} />
          )}
          {policy.payment_frequency && (
            <InfoRow label="Frecuencia de pago"
              value={PAYMENT_FREQ_LABELS[policy.payment_frequency] ?? policy.payment_frequency} />
          )}
          {policy.renewal_status && (
            <InfoRow label="Estado de renovación"
              value={
                <Badge variant={
                  policy.renewal_status === 'renewed' ? 'success' :
                  policy.renewal_status === 'lost'    ? 'danger'  : 'muted'
                } className="text-2xs">
                  {RENEWAL_STATUS_LABELS[policy.renewal_status] ?? policy.renewal_status}
                </Badge>
              }
            />
          )}
          {policy.producer && (
            <InfoRow label="Productor" value={policy.producer.full_name} />
          )}
          {policy.notes && (
            <InfoRow label="Notas" value={
              <span className="text-ink-secondary text-right max-w-[250px] whitespace-pre-wrap">
                {policy.notes}
              </span>
            } />
          )}
        </div>
      </div>

      {/* Risk */}
      {policy.risk && (
        <div className="card px-4 py-3">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-2">Riesgo vinculado</p>
          <div className="flex items-center justify-between">
            <RiskSummary type={policy.risk.type} data={policy.risk.data} />
          </div>
        </div>
      )}

      {/* Coverage summary */}
      {policy.coverage_summary && Object.keys(policy.coverage_summary).length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">Resumen de coberturas</p>
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(policy.coverage_summary as Record<string, unknown>).map(([k, v]) => (
                <span key={k} className="text-xs bg-surface-muted text-ink-secondary px-2 py-0.5 rounded">
                  <span className="font-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  {v !== null && v !== true && <span className="text-ink-tertiary">: {String(v)}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Documents */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">
            Documentos
            {docs.length > 0 && (
              <span className="ml-2 bg-surface-muted text-ink-tertiary px-1.5 py-0.5 rounded-full text-2xs">
                {docs.length}
              </span>
            )}
          </p>
          {me?.org_id && (
            <button onClick={() => setShowUpload(o => !o)}
              className="text-xs text-brand hover:underline">
              {showUpload ? 'Cancelar' : '+ Subir'}
            </button>
          )}
        </div>
        {showUpload && me?.org_id && (
          <div className="px-4 py-3 border-b border-surface-border bg-surface-subtle animate-fade-in">
            <DocumentUploader
              orgId={me.org_id}
              entityType="policy"
              entityId={id}
              defaultDocType="poliza_pdf"
              allowedTypes={['application/pdf', 'image/jpeg', 'image/png']}
              onUploaded={doc => { setDocs(prev => [doc, ...prev]); setShowUpload(false) }}
              onCancel={() => setShowUpload(false)}
              compact
            />
          </div>
        )}
        <DocumentList documents={docs} loading={docsLoading}
          emptyText="Sin documentos adjuntos. Subí la póliza en PDF." />
      </div>

      {/* External info */}
      {(policy.external_policy_number || policy.external_company_id) && (
        <div className="card px-4 py-3">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-2">Referencia externa</p>
          <div className="space-y-1.5">
            {policy.external_policy_number && (
              <p className="text-sm font-mono text-ink-secondary">
                Nro. externo: {policy.external_policy_number}
              </p>
            )}
            {policy.external_company_id && (
              <p className="text-sm text-ink-secondary">
                ID compañía: {policy.external_company_id}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
  )
}
