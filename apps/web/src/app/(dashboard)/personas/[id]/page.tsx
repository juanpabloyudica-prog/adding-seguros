'use client'

import { useEffect, useState, useCallback } from 'react'

import { useState } from 'react'

import Link from 'next/link'
import { ArrowLeft, Edit2, Building2, Tag, Phone, Mail, MapPin, Plus } from 'lucide-react'
import { usePersonDetail } from '@/hooks/usePersons'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'
import { useCurrentUser } from '@/hooks/useConversations'
import { getPolicies } from '@/lib/api/policies'
import { getConversations } from '@/lib/api/conversations'
import { getDocuments } from '@/lib/api/documents'
import { DocumentUploader } from '@/components/domain/documents/DocumentUploader'
import { DocumentList } from '@/components/domain/documents/DocumentList'
import { PolicyStatusBadge } from '@/components/domain/policies/PolicyStatusBadge'
import type { PolicyWithComputed } from '@/lib/api/policies'
import type { ConversationDetail } from '@/lib/api/conversations'
import type { Document } from '@/lib/api/documents'
import { PersonMetadataBar } from '@/components/domain/persons/PersonMetadataBar'
import { PersonInfoGrid } from '@/components/domain/persons/PersonInfoGrid'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card">
      <div className="px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-600 text-ink">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

// ─── Assignee card ────────────────────────────────────────────────────────────
function AssigneeCard({
  label,
  name,
  sub,
  variant = 'default',
}: {
  label: string
  name?: string | null
  sub?:  string | null
  variant?: 'producer' | 'default'
}) {
  if (!name) return null
  return (
    <div className="flex items-center gap-3">
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center text-sm font-600 shrink-0
        ${variant === 'producer' ? 'bg-brand/10 text-brand' : 'bg-surface-muted text-ink-secondary'}
      `}>
        {name[0]?.toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-ink-tertiary">{label}</p>
        <p className="text-sm font-500 text-ink truncate">{name}</p>
        {sub && <p className="text-2xs text-ink-tertiary truncate">{sub}</p>}
      </div>
    </div>
  )
}


// ─── PersonPolicies — real policies for this person ───────────────────────────
function PersonPolicies({ personId }: { personId: string }) {
  const [policies, setPolicies] = useState<PolicyWithComputed[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    getPolicies({ person_id: personId, limit: 10 } as Record<string, string | number>)
      .then(r => setPolicies(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [personId])

  return (
    <Section title="Pólizas" id="polizas">
      {loading ? (
        <div className="px-4 py-2 space-y-1.5">
          {[1,2].map(i => <div key={i} className="h-10 bg-surface-muted rounded animate-pulse" />)}
        </div>
      ) : policies.length === 0 ? (
        <p className="text-sm text-ink-tertiary px-4 py-3">Sin pólizas registradas.</p>
      ) : (
        <div className="divide-y divide-surface-border">
          {policies.map(p => (
            <a key={p.id} href={`/polizas/${p.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-subtle transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-500 text-ink font-mono">{p.policy_number}</p>
                  <PolicyStatusBadge status={p.computed_status} />
                </div>
                <p className="text-xs text-ink-tertiary">
                  {p.company?.name} · {p.ramo}
                  {p.end_date && ` · vence ${new Date(p.end_date).toLocaleDateString('es-AR', {day:'2-digit', month:'short', year:'numeric'})}`}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── PersonConversations ───────────────────────────────────────────────────────
function PersonConversations({ personId }: { personId: string }) {
  const [convs,   setConvs]   = useState<ConversationDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConversations({ person_id: personId, limit: 5 })
      .then(r => setConvs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [personId])

  return (
    <Section title="Conversaciones" id="conversaciones">
      {loading ? (
        <div className="px-4 py-2 space-y-1.5">
          <div className="h-10 bg-surface-muted rounded animate-pulse" />
        </div>
      ) : convs.length === 0 ? (
        <p className="text-sm text-ink-tertiary px-4 py-3">Sin conversaciones.</p>
      ) : (
        <div className="divide-y divide-surface-border">
          {convs.map(c => (
            <a key={c.id} href={`/conversaciones/${c.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-subtle transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-ink">{c.wa_phone}</p>
                {c.last_message_text && (
                  <p className="text-xs text-ink-tertiary truncate">{c.last_message_text}</p>
                )}
              </div>
              {c.unread_count > 0 && (
                <span className="w-5 h-5 rounded-full bg-brand text-white text-2xs flex items-center justify-center font-600 shrink-0">
                  {c.unread_count}
                </span>
              )}
              <svg className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </a>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── PersonDocuments ───────────────────────────────────────────────────────────
function PersonDocuments({ personId, orgId }: { personId: string; orgId: string }) {
  const [docs,       setDocs]       = useState<Document[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    getDocuments({ entity_type: 'person', entity_id: personId })
      .then(r => setDocs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [personId])

  useEffect(() => { reload() }, [reload])

  return (
    <Section title="Documentos" id="documentos">
      <div className="px-4 pt-2 pb-1 flex items-center justify-between -mt-1">
        <span />
        {orgId && (
          <button onClick={() => setShowUpload(o => !o)}
            className="text-xs text-brand hover:underline">
            {showUpload ? 'Cancelar' : '+ Subir'}
          </button>
        )}
      </div>
      {showUpload && orgId && (
        <div className="px-4 pb-3 animate-fade-in">
          <DocumentUploader
            orgId={orgId}
            entityType="person"
            entityId={personId}
            defaultDocType="dni"
            onUploaded={doc => { setDocs(prev => [doc, ...prev]); setShowUpload(false) }}
            onCancel={() => setShowUpload(false)}
            compact
          />
        </div>
      )}
      <DocumentList documents={docs} loading={loading}
        emptyText="Sin documentos adjuntos." />
    </Section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PersonDetailPage({ params }: { params: { id: string } }) {
  const { id } = params
  const { data: person, loading, error } = usePersonDetail(id)

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-[72px] rounded-card" />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-3xl space-y-4">
        <Link href="/personas" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Personas
        </Link>
        <ErrorAlert message={error} />
      </div>
    )
  }

  if (!person) return null

  // ── Address formatting ────────────────────────────────────────────────────
  const addr = person.address
  const addressStr = addr
    ? [addr.street, addr.city, addr.province, addr.zip].filter(Boolean).join(', ')
    : null

  const { user: me } = useCurrentUser()
  const [showNewCase, setShowNewCase] = useState(false)

  return (
    <div className="space-y-4 max-w-3xl animate-fade-in">

      {/* Back + header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Link
            href="/personas"
            className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          {/* Avatar + name */}
          <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-600 shrink-0">
            {person.is_company
              ? <Building2 className="w-4 h-4" />
              : person.full_name[0]?.toUpperCase()
            }
          </div>

          <div className="min-w-0">
            <h1 className="text-base font-600 text-ink leading-tight truncate">{person.full_name}</h1>
            {person.doc_type && person.doc_number && (
              <p className="text-xs text-ink-tertiary font-mono">
                {person.doc_type} {person.doc_number}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Edit2 className="w-3.5 h-3.5" />}
          onClick={() => window.location.href = `/personas/${id}/editar`}
        >
          Editar
        </Button>
      </div>

      {/* Metadata counts bar */}
      {person.metadata && (
        <PersonMetadataBar personId={id} metadata={person.metadata} />
      )}

      {/* Main info */}
      <Section title="Datos básicos">
        <PersonInfoGrid cols={3} fields={[
          {
            label: 'Teléfono',
            value: person.phone
              ? (
                <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-brand hover:underline">
                  <Phone className="w-3 h-3" /> {person.phone}
                </a>
              )
              : null,
          },
          {
            label: 'Email',
            value: person.email
              ? (
                <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-brand hover:underline truncate">
                  <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{person.email}</span>
                </a>
              )
              : null,
          },
          {
            label: 'Tipo',
            value: person.is_company ? 'Persona jurídica' : 'Persona física',
          },
          {
            label: 'Documento',
            value: person.doc_type && person.doc_number
              ? `${person.doc_type} ${person.doc_number}`
              : null,
            mono: true,
          },
          {
            label: 'Nacimiento',
            value: person.birthdate
              ? new Date(person.birthdate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
              : null,
          },
          {
            label: 'Género',
            value: person.gender,
          },
          ...(addressStr ? [{
            label: 'Dirección',
            value: (
              <span className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-ink-tertiary" />
                {addressStr}
              </span>
            ),
          }] : []),
          ...(person.notes ? [{
            label: 'Notas',
            value: <span className="whitespace-pre-wrap">{person.notes}</span>,
          }] : []),
        ]} />
      </Section>

      {/* Tags */}
      {(person.tags ?? []).length > 0 && (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {(person.tags ?? []).map((tag) => (
              <Badge key={tag} variant="muted">
                <Tag className="w-2.5 h-2.5 mr-1 inline" />{tag}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Assignments */}
      {(person.producer || person.assigned_to) && (
        <Section title="Asignaciones">
          <div className="flex flex-col sm:flex-row gap-4">
            {person.producer && (
              <AssigneeCard
                label="Productor asociado"
                name={person.producer.full_name}
                sub={(person.producer.specialties ?? []).join(' · ') || null}
                variant="producer"
              />
            )}
            {person.assigned_to && (
              <AssigneeCard
                label="Operativo asignado"
                name={person.assigned_to.full_name}
                sub={person.assigned_to.email}
              />
            )}
          </div>
        </Section>
      )}

      <PersonPolicies personId={id} />

      <Section title="Casos abiertos" id="casos">
        <div className="flex items-center justify-between px-4 py-2 -mt-2">
          <p className="text-sm text-ink-tertiary">
            {person.metadata?.open_case_count
              ? `${person.metadata.open_case_count} caso${person.metadata.open_case_count !== 1 ? 's' : ''} abierto${person.metadata.open_case_count !== 1 ? 's' : ''}`
              : 'Sin casos abiertos.'}
          </p>
          <Button
            variant="secondary" size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowNewCase(true)}
          >
            Nuevo caso
          </Button>
        </div>
      </Section>

      {showNewCase && (
        <NewCaseModal
          personId={id}
          personName={person.full_name}
          onClose={() => setShowNewCase(false)}
        />
      )}

      <PersonConversations personId={id} />

      <PersonDocuments personId={id} orgId={me?.org_id ?? ''} />
    </div>
  )
}
