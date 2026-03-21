'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Star, Check, Shield, User, ChevronDown, ChevronUp} from 'lucide-react'
import { getQuotePdfData, getDocuments } from '@/lib/api/documents'
import type { QuotePdfData, Document } from '@/lib/api/documents'
import { DocumentUploader } from '@/components/domain/documents/DocumentUploader'
import { DocumentList   } from '@/components/domain/documents/DocumentList'
import { GeneratePdfButton } from '@/components/domain/documents/QuotePdf'
import { Skeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@adding/utils'
import { useCurrentUser } from '@/hooks/useConversations'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function RankingStars({ n }: { n: number | null }) {
  if (!n) return null
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3 h-3 ${i < n ? 'text-warning fill-warning' : 'text-surface-border'}`} />
      ))}
    </span>
  )
}

function CoverageList({ coverage }: { coverage: Record<string, unknown> }) {
  const entries = Object.entries(coverage)
  if (!entries.length) return <p className="text-xs text-ink-tertiary italic">Sin detalle</p>
  return (
    <ul className="space-y-0.5">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-baseline gap-2 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-brand/40 shrink-0 mt-1" />
          <span className="font-500 capitalize text-ink">{k.replace(/_/g, ' ')}</span>
          {v !== null && v !== true && <span className="text-ink-secondary">{String(v)}</span>}
        </li>
      ))}
    </ul>
  )
}

function RiskSummary({ type, data }: { type: string | null; data: Record<string, unknown> | null }) {
  if (!type) return null
  const d = data ?? {}
  const parts = [
    type.charAt(0).toUpperCase() + type.slice(1),
    d['marca'] && d['modelo'] ? `${d['marca']} ${d['modelo']}` : null,
    d['anio'] ? String(d['anio']) : null,
    d['patente'] ? String(d['patente']) : null,
  ].filter(Boolean)
  return <span>{parts.join(' · ')}</span>
}

// ─── Collapsible section ──────────────────────────────────────────────────────
function Section({
  title, defaultOpen = true, badge, children}: {
  title: string; defaultOpen?: boolean
  badge?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-surface-border hover:bg-surface-subtle transition-colors">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-600 text-ink">{title}</h2>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-ink-tertiary" /> : <ChevronDown className="w-4 h-4 text-ink-tertiary" />}
      </button>
      {open && <div>{children}</div>}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function QuotePropuestaPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { user: me } = useCurrentUser()

  const [pdfData,   setPdfData]   = useState<QuotePdfData | null>(null)
  const [docs,      setDocs]      = useState<Document[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [pdfRes, docsRes] = await Promise.all([
        getQuotePdfData(id),
        getDocuments({ entity_type: 'quote', entity_id: id }),
      ])
      setPdfData(pdfRes.data)
      setDocs(docsRes.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar propuesta')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const handleDocUploaded = (doc: Document) => {
    setDocs(prev => [doc, ...prev])
    setShowUpload(false)
  }

  const handlePdfGenerated = (doc: Document) => {
    setDocs(prev => [doc, ...prev])
  }

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-32 rounded-card" />
      <Skeleton className="h-56 rounded-card" />
    </div>
  )

  if (error) return (
    <div className="max-w-2xl space-y-3">
      <Link href={`/cotizaciones/${id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
        <ArrowLeft className="w-3.5 h-3.5" /> Cotización
      </Link>
      <ErrorAlert message={error} />
    </div>
  )

  if (!pdfData) return null

  const { quote, options_for_client, selected_option } = pdfData
  const orgId = me?.org_id ?? ''

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">

      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link href={`/cotizaciones/${id}`}
          className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-base font-600 text-ink">Propuesta comercial</h1>
          <p className="text-xs text-ink-tertiary">
            {new Date().toLocaleString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Documents / PDFs ──────────────────────────────────────────────── */}
      <Section
        title="Documentos"
        defaultOpen={true}
        badge={docs.length > 0 && (
          <span className="text-2xs bg-surface-muted text-ink-secondary px-1.5 py-0.5 rounded-full">
            {docs.length}
          </span>
        )}
      >
        {/* Generate printable HTML proposal — note: this is NOT a binary PDF */}
        <div className="px-4 pt-3 pb-2 flex flex-wrap gap-2 border-b border-surface-border">
          {orgId && (
            <GeneratePdfButton
              quoteId={id}
              orgId={orgId}
              pdfData={pdfData}
              onGenerated={handlePdfGenerated}
            />
          )}
          <Button variant="secondary" size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowUpload(s => !s)}>
            Subir documento
          </Button>
        </div>

        {/* Upload widget */}
        {showUpload && orgId && (
          <div className="px-4 py-3 border-b border-surface-border bg-surface-subtle animate-fade-in">
            <DocumentUploader
              orgId={orgId}
              entityType="quote"
              entityId={id}
              defaultDocType="cotizacion"
              allowedTypes={['application/pdf', 'image/jpeg', 'image/png', 'text/html']}
              onUploaded={handleDocUploaded}
              onCancel={() => setShowUpload(false)}
            />
          </div>
        )}

        {/* Document list */}
        <DocumentList
          documents={docs}
          emptyText="Sin documentos. Generá la propuesta o subí un archivo."
        />
      </Section>

      {/* ── Client info + risk ────────────────────────────────────────────── */}
      <Section title="Datos del asegurado" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
          <div>
            <p className="text-2xs text-ink-tertiary font-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <User className="w-3 h-3" /> Cliente
            </p>
            <p className="text-sm font-500 text-ink">{quote.person_name ?? '—'}</p>
            {quote.person_doc_type && quote.person_doc_number && (
              <p className="text-xs text-ink-secondary font-mono mt-0.5">
                {quote.person_doc_type} {quote.person_doc_number}
              </p>
            )}
            {quote.person_phone && <p className="text-xs text-ink-secondary">{quote.person_phone}</p>}
            {quote.person_email && <p className="text-xs text-ink-secondary">{quote.person_email}</p>}
          </div>
          {quote.risk_type && (
            <div>
              <p className="text-2xs text-ink-tertiary font-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Riesgo
              </p>
              <p className="text-sm text-ink">
                <RiskSummary type={quote.risk_type} data={quote.risk_data} />
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* ── Options for client ────────────────────────────────────────────── */}
      <Section
        title="Opciones presentadas al cliente"
        defaultOpen={true}
        badge={
          <span className="text-2xs bg-info-bg text-info-text px-1.5 py-0.5 rounded-full font-500">
            {options_for_client.length}
          </span>
        }
      >
        {options_for_client.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-ink-tertiary">No se marcaron opciones para enviar al cliente.</p>
            <p className="text-xs text-ink-tertiary mt-1">
              En la cotización, usá <strong>Incluir en envío</strong> en cada opción.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {options_for_client.map(opt => (
              <div key={opt.id}
                className={`border rounded-xl overflow-hidden ${opt.is_selected ? 'border-brand ring-1 ring-brand/30' : 'border-surface-border'}`}>
                {/* Header */}
                <div className="flex items-start gap-3 px-4 py-3 bg-surface-subtle border-b border-surface-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-600 text-ink">{opt.company_name}</p>
                      <span className="text-xs text-ink-secondary">{opt.plan_name}</span>
                      <RankingStars n={opt.company_ranking} />
                      {opt.is_selected && (
                        <Badge variant="success" className="text-2xs">
                          <Check className="w-2.5 h-2.5 mr-0.5 inline" /> Elegida
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-600 text-ink tabular-nums">
                      {formatCurrency(opt.premium, opt.currency)}
                    </p>
                    <p className="text-2xs text-ink-tertiary">{opt.currency} / mes</p>
                  </div>
                </div>
                {/* Coverage */}
                {Object.keys(opt.coverage ?? {}).length > 0 && (
                  <div className="px-4 py-3">
                    <CoverageList coverage={opt.coverage} />
                  </div>
                )}
                {/* Payment options */}
                {opt.payment_options && Object.keys(opt.payment_options).length > 0 && (
                  <div className="px-4 py-2 bg-surface-muted/50 border-t border-surface-border">
                    <p className="text-2xs text-ink-tertiary font-500 uppercase tracking-wide mb-1">Formas de pago</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(opt.payment_options).map(([k, v]) => (
                        <span key={k} className="text-2xs bg-surface text-ink-secondary px-2 py-0.5 rounded border border-surface-border">
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Selection result ──────────────────────────────────────────────── */}
      {selected_option && (
        <div className="card px-4 py-3 bg-brand/5 border-brand/20">
          <p className="text-xs font-500 text-brand mb-1">El cliente eligió</p>
          <p className="text-sm font-600 text-ink">
            {selected_option.company_name} · {selected_option.plan_name} — {formatCurrency(selected_option.premium, selected_option.currency)}/mes
          </p>
          {quote.selection_reason && (
            <p className="text-xs text-ink-secondary mt-1">Motivo: {quote.selection_reason}</p>
          )}
        </div>
      )}

      {/* ── Internal recommendation ───────────────────────────────────────── */}
      {quote.internal_recommendation && (
        <div className="card px-4 py-3 border-success/20 bg-success-bg/30">
          <p className="text-2xs text-ink-tertiary font-500 uppercase tracking-wide mb-1">
            Recomendación interna (no mostrar al cliente)
          </p>
          <p className="text-sm text-ink">{quote.internal_recommendation}</p>
        </div>
      )}

      {/* ── Org + producer footer ─────────────────────────────────────────── */}
      <div className="text-xs text-ink-tertiary text-center pb-4">
        {quote.org_name}
        {quote.producer_name && ` · ${quote.producer_name}`}
        {quote.producer_signature && ` · ${quote.producer_signature}`}
      </div>
    </div>
  )
}
