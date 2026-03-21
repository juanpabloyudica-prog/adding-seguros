'use client'

import { useState } from 'react'
import { User, Phone, AlertTriangle, Lock, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { ConversationStatusBadge } from './ConversationStatusBadge'
import { Button } from '@/components/ui/Button'
import type { ConversationDetail } from '@/lib/api/conversations'
import { CaseStatusBadge } from '@/components/domain/cases/CaseStatusBadge'
import type { OrgUser } from '@/lib/api/users'

interface ConversationPanelProps {
  conversation:  ConversationDetail
  currentUserId: string
  orgUsers:      OrgUser[]
  onEscalate:    (userId: string) => Promise<unknown>
  onDeescalate:  () => Promise<unknown>
  onTakeover:    (force?: boolean) => Promise<unknown>
  onRelease:     () => Promise<unknown>
  onStatusChange: (status: string) => Promise<unknown>
  acting:        boolean
}

const STATUS_OPTIONS = [
  { value: 'open',              label: 'Abierta'          },
  { value: 'waiting_operativo', label: 'Esp. operativo'   },
  { value: 'waiting_productor', label: 'Esp. productor'   },
  { value: 'resolved',          label: 'Resuelta'         },
  { value: 'closed',            label: 'Cerrada'          },
]

function InfoRow({ icon: Icon, label, value }: {
  icon: React.ElementType; label: string; value: React.ReactNode
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-surface-border last:border-0">
      <Icon className="w-3.5 h-3.5 text-ink-tertiary mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-2xs text-ink-tertiary">{label}</p>
        <div className="text-sm text-ink mt-0.5">{value}</div>
      </div>
    </div>
  )
}

export function ConversationPanel({
  conversation, currentUserId, orgUsers,
  onEscalate, onDeescalate, onTakeover, onRelease, onStatusChange, acting}: ConversationPanelProps) {
  const [showEscalateMenu, setShowEscalateMenu] = useState(false)
  const [showStatusMenu,   setShowStatusMenu]   = useState(false)
  const [collapsed, setCollapsed]               = useState(false)

  const isLocked      = !!conversation.locked_by_user_id
  const lockedByMe    = conversation.locked_by_user_id === currentUserId
  const isEscalated   = !!conversation.escalated_to_user_id

  const eligibleForEscalation = orgUsers.filter(
    (u) => u.id !== currentUserId && (u.role === 'productor' || u.role === 'supervisor' || u.role === 'admin')
  )

  return (
    <div className="flex flex-col bg-surface border-l border-surface-border h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">Detalle</p>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-ink-tertiary hover:text-ink p-0.5 lg:hidden"
        >
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Info rows */}
          <div className="px-4 py-2">
            <InfoRow
              icon={Phone}
              label="Teléfono"
              value={
                <a href={`tel:${conversation.wa_phone}`} className="text-brand hover:underline font-mono">
                  {conversation.wa_phone}
                </a>
              }
            />
            <InfoRow
              icon={User}
              label="Persona vinculada"
              value={
                conversation.person ? (
                  <Link href={`/personas/${conversation.person.id}`}
                    className="text-brand hover:underline text-sm">
                    {conversation.person.full_name}
                  </Link>
                ) : null
              }
            />
            {conversation.linked_case && (
              <InfoRow
                icon={FolderOpen}
                label="Gestión vinculada"
                value={
                  <Link href={`/gestiones/${conversation.linked_case.id}`}
                    className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                    <span className="text-sm text-ink truncate max-w-[140px]">
                      {conversation.linked_case.title}
                    </span>
                    <CaseStatusBadge status={conversation.linked_case.status} />
                  </Link>
                }
              />
            )}
            <InfoRow
              icon={User}
              label="Asignado a"
              value={conversation.assigned_to?.full_name}
            />
            {isEscalated && (
              <InfoRow
                icon={AlertTriangle}
                label="Escalado a"
                value={
                  <span className="text-danger font-500">
                    {conversation.escalated_to?.full_name}
                  </span>
                }
              />
            )}
            {isLocked && (
              <InfoRow
                icon={Lock}
                label={lockedByMe ? 'Lo tenés vos' : 'Tomado por'}
                value={
                  <span className={lockedByMe ? 'text-brand' : 'text-warning'}>
                    {lockedByMe ? 'Tú' : conversation.locked_by?.full_name}
                  </span>
                }
              />
            )}
          </div>

          {/* Status */}
          <div className="px-4 py-3 border-t border-surface-border">
            <p className="text-2xs text-ink-tertiary mb-2">Estado</p>
            <div className="relative">
              <button
                onClick={() => setShowStatusMenu(s => !s)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-border hover:bg-surface-subtle transition-colors text-sm"
              >
                <ConversationStatusBadge status={conversation.status} />
                <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary" />
              </button>
              {showStatusMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 card shadow-dropdown py-1 animate-fade-in">
                    {STATUS_OPTIONS.filter(s => s.value !== conversation.status).map((s) => (
                      <button
                        key={s.value}
                        disabled={acting}
                        onClick={async () => {
                          await onStatusChange(s.value)
                          setShowStatusMenu(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-subtle transition-colors"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 border-t border-surface-border space-y-2">
            <p className="text-2xs text-ink-tertiary mb-1">Acciones</p>

            {/* Takeover / Release */}
            {!lockedByMe ? (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                loading={acting}
                icon={<Lock className="w-3.5 h-3.5" />}
                onClick={() => onTakeover(isLocked)}
              >
                {isLocked ? 'Forzar toma' : 'Tomar conversación'}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-ink-secondary"
                loading={acting}
                onClick={() => onRelease()}
              >
                Liberar conversación
              </Button>
            )}

            {/* Escalate / De-escalate */}
            {!isEscalated ? (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  loading={acting}
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  onClick={() => setShowEscalateMenu(s => !s)}
                >
                  Escalar
                </Button>
                {showEscalateMenu && eligibleForEscalation.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowEscalateMenu(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 card shadow-dropdown py-1 animate-fade-in">
                      <p className="px-3 py-1.5 text-2xs text-ink-tertiary font-500 uppercase tracking-wide">
                        Escalar a
                      </p>
                      {eligibleForEscalation.map((u) => (
                        <button
                          key={u.id}
                          onClick={async () => {
                            await onEscalate(u.id)
                            setShowEscalateMenu(false)
                          }}
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
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-danger hover:bg-danger-bg"
                loading={acting}
                onClick={() => onDeescalate()}
              >
                Quitar escalamiento
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
