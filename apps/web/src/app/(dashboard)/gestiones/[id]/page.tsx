'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Shield, MessageSquare,
  FileText, ExternalLink, ChevronDown, ChevronUp, Link2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useCaseDetail, useCaseActions } from '@/hooks/useCases'
import { useOrgUsers } from '@/hooks/useConversations'
import { getCaseConversations, getCaseDocuments } from '@/lib/api/cases'
import { getConversations } from '@/lib/api/conversations'
import type { CaseLinkedConversation, CaseDocument } from '@/lib/api/cases'
import { CaseStatusBadge } from '@/components/domain/cases/CaseStatusBadge'
import { useToast } from '@/components/ui/Toast'
import { CasePriorityBadge } from '@/components/domain/cases/CasePriorityBadge'
import { CaseTimeline } from '@/components/domain/cases/CaseTimeline'
import { CaseWorkflowStepper } from '@/components/domain/cases/CaseWorkflowStepper'
import { CaseActions } from '@/components/domain/cases/CaseActions'
import { Skeleton, CardSkeleton } from '@/components/ui/Skeleton'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Button } from '@/components/ui/Button'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title, id, defaultOpen = true, badge, children,
}: {
  title: string; id?: string; defaultOpen?: boolean
  badge?: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 border-b border-surface-border hover:bg-surface-subtle transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-600 text-ink">{title}</h2>
          {badge}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-ink-tertiary" />
          : <ChevronDown className="w-4 h-4 text-ink-tertiary" />
        }
      </button>
      {open && <div>{children}</div>}
    </section>
  )
}

// ─── Assign dropdown ──────────────────────────────────────────────────────────
function AssignDropdown({
  currentName, orgUsers, onAssign, acting,
}: {
  currentName?: string | null
  orgUsers: { id: string; full_name: string; role: string }[]
  onAssign: (userId: string) => void
  acting: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={acting}
        className="flex items-center gap-1.5 text-sm text-ink-secondary hover:text-brand transition-colors"
      >
        <User className="w-3.5 h-3.5" />
        <span>{currentName ?? 'Sin asignar'}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 card shadow-dropdown py-1 min-w-[180px] animate-fade-in">
            <p className="px-3 py-1 text-2xs text-ink-tertiary uppercase tracking-wide font-500">Asignar a</p>
            {orgUsers.map(u => (
              <button
                key={u.id}
                onClick={() => { onAssign(u.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-subtle transition-colors"
              >
                <p className="font-500">{u.full_name}</p>
                <p className="text-2xs text-ink-tertiary capitalize">{u.role}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Linked conversations panel ───────────────────────────────────────────────
function LinkedConversations({
  caseId, personId, onLink,
}: { caseId: string; personId?: string | null; onLink?: () => void }) {
  const [convs,        setConvs]        = useState<CaseLinkedConversation[]>([])
  const [personConvs,  setPersonConvs]  = useState<{id:string;wa_phone:string;wa_contact_name:string|null}[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showPicker,   setShowPicker]   = useState(false)
  const [linking,      setLinking]      = useState(false)

  const reload = () => {
    setLoading(true)
    getCaseConversations(caseId)
      .then(r => setConvs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [caseId])

  // Load person's conversations for the picker
  useEffect(() => {
    if (!personId || !showPicker) return
    getConversations({ person_id: personId, limit: 10 } as Parameters<typeof getConversations>[0])
      .then(r => setPersonConvs(r.data.map(c => ({ id: c.id, wa_phone: c.wa_phone, wa_contact_name: c.wa_contact_name }))))
      .catch(() => {})
  }, [personId, showPicker])

  const handleLink = async (convId: string) => {
    setLinking(true)
    try {
      const { linkCaseConversation } = await import('@/lib/api/cases')
      await linkCaseConversation(caseId, convId)
      setShowPicker(false)
      reload()
      onLink?.()
    } catch {} finally { setLinking(false) }
  }

  if (loading) return <div className="p-4"><Skeleton className="h-10 w-full rounded" /></div>

  return (
    <div>
      {convs.length === 0 ? (
        <div className="px-4 py-3 space-y-2">
          <p className="text-sm text-ink-tertiary">Sin conversaciones vinculadas.</p>
          {personId && (
            <>
              <button
                onClick={() => setShowPicker(s => !s)}
                className="text-xs text-brand hover:underline flex items-center gap-1"
              >
                <Link2 className="w-3 h-3" /> Vincular una conversación existente
              </button>
              {showPicker && (
                <div className="space-y-1 pt-1">
                  {personConvs.length === 0 && (
                    <p className="text-xs text-ink-tertiary">No hay conversaciones disponibles para esta persona.</p>
                  )}
                  {personConvs.map(c => (
                    <button
                      key={c.id}
                      disabled={linking}
                      onClick={() => handleLink(c.id)}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-muted transition-colors border border-surface-border"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
                      <span className="text-sm font-mono text-ink">{c.wa_phone}</span>
                      {c.wa_contact_name && (
                        <span className="text-xs text-ink-tertiary">· {c.wa_contact_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-surface-border">
          {convs.map(c => (
            <Link
              key={c.id}
              href={`/conversaciones/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors group"
            >
              <MessageSquare className="w-4 h-4 text-ink-tertiary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-ink truncate">{c.wa_phone}</p>
                {c.last_message_text && (
                  <p className="text-xs text-ink-tertiary truncate">{c.last_message_text}</p>
                )}
              </div>
              {c.unread_count > 0 && (
                <span className="w-5 h-5 rounded-full bg-brand text-white text-2xs flex items-center justify-center font-600 shrink-0">
                  {c.unread_count}
                </span>
              )}
              <ExternalLink className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Documents panel ──────────────────────────────────────────────────────────
function CaseDocuments({ caseId }: { caseId: string }) {
  const [docs, setDocs]       = useState<CaseDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCaseDocuments(caseId)
      .then(r => setDocs(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [caseId])

  if (loading) return <div className="p-4"><Skeleton className="h-10 w-full rounded" /></div>
  if (!docs.length) return (
    <div className="px-4 py-3 text-sm text-ink-tertiary">Sin documentos adjuntos.</div>
  )

  return (
    <div className="divide-y divide-surface-border">
      {docs.map(d => (
        <a
          key={d.id}
          href={d.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors group"
        >
          <FileText className="w-4 h-4 text-ink-tertiary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-ink truncate">{d.file_name}</p>
            <p className="text-xs text-ink-tertiary">{d.type} · {d.uploaded_by_name}</p>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      ))}
    </div>
  )
}

// ─── Scheduled messages for this case ────────────────────────────────────────
function ScheduledForCase({ caseId }: { caseId: string }) {
  const [msgs, setMsgs]       = useState<{id:string;status:string;scheduled_for:string;template?:{name:string}|null}[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    import('@/lib/api/automations').then(({ getScheduledMessages }) =>
      getScheduledMessages({ case_id: caseId, limit: 5 })
        .then(r => setMsgs(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    )
  }, [caseId])

  if (loading) return null
  if (msgs.length === 0) return null

  const pendingCount = msgs.filter(m => m.status === 'pending').length

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-600 text-ink flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-ink-tertiary" /> Mensajes programados
        </h2>
        {pendingCount > 0 && (
          <span className="text-2xs bg-warning-bg text-warning px-1.5 py-0.5 rounded-full font-500">
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="divide-y divide-surface-border">
        {msgs.slice(0, 3).map(m => (
          <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className="text-xs font-500 text-ink">{m.template?.name ?? 'Mensaje'}</p>
              <p className="text-2xs text-ink-tertiary">
                {new Date(m.scheduled_for).toLocaleString('es-AR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
            <span className={clsx('text-2xs font-500 px-1.5 py-0.5 rounded-full',
              m.status === 'pending' ? 'bg-warning-bg text-warning' :
              m.status === 'sent'    ? 'bg-success-bg text-success-text' :
              'bg-surface-muted text-ink-tertiary'
            )}>
              {m.status === 'pending' ? 'Pendiente' : m.status === 'sent' ? 'Enviado' : m.status}
            </span>
          </div>
        ))}
      </div>
      {msgs.length > 3 && (
        <a href={`/automatizaciones?tab=programados&case_id=${caseId}`}
          className="block px-4 py-2 text-xs text-brand hover:underline text-center border-t border-surface-border">
          Ver todos →
        </a>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const { id }     = params
  const router     = useRouter()
  const { users: orgUsers } = useOrgUsers()

  const { data: caseData, loading, error, refetch } = useCaseDetail(id)

  const {
    changeStatus, changeStep, close, addNote, update,
    acting, error: actionError, clearError,
  } = useCaseActions(id, () => {
    refetch()
    toastSuccess('Gestión actualizada')
  })
  const { success: toastSuccess, error: toastError } = useToast()

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-56" />
        </div>
        <CardSkeleton rows={3} />
        <CardSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl space-y-3">
        <Link href="/gestiones" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink">
          <ArrowLeft className="w-3.5 h-3.5" /> Gestiones
        </Link>
        <ErrorAlert message={error} />
      </div>
    )
  }

  if (!caseData) return null

  const isClosed = caseData.status === 'closed' || caseData.status === 'cancelled'

  // Required documents not yet uploaded (simplified: just show the list)
  const requiredDocs: string[] = caseData.required_documents ?? []

  return (
    <div className="max-w-5xl space-y-4 animate-fade-in">

      {/* ── Back + header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link
            href="/gestiones"
            className="p-1.5 rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink transition-colors shrink-0 mt-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-600 text-ink">{caseData.title}</h1>
              <CaseStatusBadge status={caseData.status} />
              <CasePriorityBadge priority={caseData.priority} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-ink-tertiary">
              {/* Person — clickable */}
              {caseData.person && (
                <Link
                  href={`/personas/${caseData.person.id}`}
                  className="flex items-center gap-1 hover:text-brand transition-colors"
                >
                  <User className="w-3 h-3" />
                  {caseData.person.full_name}
                </Link>
              )}
              {/* Policy */}
              {caseData.policy && (
                <Link
                  href={`/polizas/${caseData.policy.id}`}
                  className="flex items-center gap-1 hover:text-brand transition-colors"
                >
                  <Shield className="w-3 h-3" />
                  {caseData.policy.policy_number} · {caseData.policy.ramo}
                </Link>
              )}
              {/* Type */}
              <span className="capitalize">{caseData.type}</span>
              {/* Current step */}
              {caseData.current_step_key && (
                <span className="text-ink-secondary font-500">→ {caseData.current_step_key}</span>
              )}
            </div>
            {/* Assign row */}
            <div className="mt-1.5">
              <AssignDropdown
                currentName={caseData.assigned_to?.full_name}
                orgUsers={orgUsers}
                onAssign={(userId) => update({ assigned_to_user_id: userId })}
                acting={acting}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: main + sidebar ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

        {/* ── LEFT: Timeline + Workflow ──────────────────────────────────── */}
        <div className="space-y-4 min-w-0">

          {/* Workflow stepper */}
          {caseData.workflow && (
            <Section title={caseData.workflow.name} defaultOpen={true}>
              <div className="p-4">
                <CaseWorkflowStepper
                  steps={caseData.workflow.steps}
                  currentStepKey={caseData.current_step_key}
                  onAdvance={(key) => changeStep(key)}
                  acting={acting}
                  caseStatus={caseData.status}
                />
              </div>
            </Section>
          )}

          {/* Description */}
          {caseData.description && (
            <Section title="Descripción" defaultOpen={true}>
              <div className="px-4 py-3">
                <p className="text-sm text-ink whitespace-pre-wrap">{caseData.description}</p>
              </div>
            </Section>
          )}

          {/* Required documents */}
          {requiredDocs.length > 0 && (
            <Section
              title="Documentos requeridos"
              badge={<span className="text-2xs bg-warning-bg text-warning px-1.5 py-0.5 rounded-full font-500">{requiredDocs.length}</span>}
              defaultOpen={true}
            >
              <ul className="px-4 py-3 space-y-1">
                {requiredDocs.map(doc => (
                  <li key={doc} className="flex items-center gap-2 text-sm text-ink-secondary">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Timeline — the heart */}
          <Section
            title="Timeline"
            badge={
              <span className="text-2xs bg-surface-muted text-ink-tertiary px-1.5 py-0.5 rounded-full">
                {caseData.timeline.length}
              </span>
            }
            defaultOpen={true}
          >
            <CaseTimeline entries={caseData.timeline} />
          </Section>

        </div>

        {/* ── RIGHT: Actions + related ──────────────────────────────────── */}
        <div className="space-y-4">

          {/* Actions */}
          <div className="card p-4">
            <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-3">Acciones</p>
            <CaseActions
              caseId={id}
              currentStatus={caseData.status}
              hasConversation={false}
              onStatusChange={changeStatus}
              onAddNote={addNote}
              onClose={close}
              acting={acting}
              error={actionError}
              onClearError={clearError}
            />
          </div>

          {/* Due date */}
          {caseData.due_date && (
            <div className="card px-4 py-3">
              <p className="text-2xs text-ink-tertiary uppercase tracking-wide font-500 mb-1">Fecha límite</p>
              <p className={clsx(
                'text-sm font-500',
                caseData.is_overdue ? 'text-danger' : 'text-ink'
              )}>
                {new Date(caseData.due_date).toLocaleDateString('es-AR', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
                {caseData.is_overdue && <span className="ml-1.5 text-danger text-xs">(vencido)</span>}
              </p>
            </div>
          )}

          {/* Conversations */}
          <Section title="Conversaciones" defaultOpen={true}>
            <LinkedConversations caseId={id} personId={caseData.person?.id} onLink={refetch} />
          </Section>

          {/* Scheduled messages for this case */}
          <ScheduledForCase caseId={id} />

          {/* Documents */}
          <Section title="Documentos" defaultOpen={false}>
            <CaseDocuments caseId={id} />
          </Section>

        </div>
      </div>
    </div>
  )
}
