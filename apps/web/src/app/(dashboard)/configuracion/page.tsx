'use client'

import { useState, useEffect, useCallback } from 'react'
import { User, Users, ToggleLeft, ToggleRight, Mail, Phone } from 'lucide-react'
import { clsx } from 'clsx'
import { getMe, getUsers, updateUser } from '@/lib/api/users'
import { useToast } from '@/components/ui/Toast'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import type { CurrentUser, OrgUser } from '@/lib/api/users'

const ROLE_LABELS: Record<string, string> = {
  admin:      'Administrador',
  operativo:  'Operativo',
  productor:  'Productor',
  readonly:   'Solo lectura'}

const ROLE_BADGE: Record<string, 'danger'|'info'|'success'|'muted'> = {
  admin:     'danger',
  operativo: 'info',
  productor: 'success',
  readonly:  'muted'}

type Tab = 'perfil' | 'usuarios'

// ─── My profile tab ────────────────────────────────────────────────────────────
function ProfileTab({ user, onUpdated }: { user: CurrentUser; onUpdated: (u: Partial<CurrentUser>) => void }) {
  const { success: toastSuccess, error: toastErrorFn } = useToast()
  const [editing,    setEditing]    = useState(false)
  const [fullName,   setFullName]   = useState(user.full_name)
  const [phone,      setPhone]      = useState(user.phone ?? '')
  const [saving,     setSaving]     = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)
  const [saveOk,     setSaveOk]     = useState(false)

  const handleSave = async () => {
    setSaving(true); setSaveError(null); setSaveOk(false)
    try {
      await updateUser(user.id, {
        full_name: fullName.trim() || undefined,
        phone:     phone.trim() || null})
      onUpdated({ full_name: fullName.trim(), phone: phone.trim() || null })
      setSaveOk(true)
      setEditing(false)
      setTimeout(() => setSaveOk(false), 3000)
      toastSuccess('Perfil actualizado correctamente')
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'Error al guardar'
      setSaveError(errMsg)
      toastErrorFn('No se pudo guardar', errMsg)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-subtle">
          <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide">Mi perfil</p>
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="text-xs text-brand hover:underline">Editar</button>
          )}
        </div>
        <div className="px-4 py-4 space-y-4">
          {/* Avatar + role */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center text-lg font-700 text-brand shrink-0">
              {(fullName || user.full_name)[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-base font-600 text-ink">{fullName || user.full_name}</p>
              <Badge variant={ROLE_BADGE[user.role] ?? 'muted'}>
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
          </div>

          {/* Editable fields */}
          {editing ? (
            <div className="space-y-3 pt-2 border-t border-surface-border">
              <div>
                <label className="text-xs font-500 text-ink-secondary block mb-1">Nombre completo</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="text-xs font-500 text-ink-secondary block mb-1">Teléfono</label>
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                  className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="text-xs font-500 text-ink-secondary block mb-1">Email</label>
                <input value={user.email} disabled
                  className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface-muted text-ink-tertiary cursor-not-allowed" />
                <p className="text-2xs text-ink-tertiary mt-0.5">El email no puede cambiarse desde aquí.</p>
              </div>
              {saveError && <p className="text-xs text-danger">{saveError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 h-8 px-3 text-sm font-500 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-colors">
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button onClick={() => { setEditing(false); setFullName(user.full_name); setPhone(user.phone ?? '') }}
                  className="px-3 h-8 text-sm text-ink-secondary hover:text-ink border border-surface-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 pt-2 border-t border-surface-border">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
                <span className="text-ink">{user.email}</span>
              </div>
              {(phone || user.phone) && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-ink-tertiary shrink-0" />
                  <span className="text-ink">{phone || user.phone}</span>
                </div>
              )}
              {saveOk && <p className="text-xs text-success">✓ Guardado correctamente</p>}
            </div>
          )}

          {/* Producer info */}
          {user.producer_id && (
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-ink-tertiary uppercase tracking-wide font-500 mb-1">
                Perfil de productor
              </p>
              {user.signature_text
                ? <p className="text-sm text-ink-secondary italic">"{user.signature_text}"</p>
                : <p className="text-sm text-ink-tertiary">Sin firma configurada.</p>
              }
            </div>
          )}
        </div>
      </div>

      {/* Password */}
      <div className="card px-4 py-3">
        <p className="text-xs font-500 text-ink-secondary uppercase tracking-wide mb-1">Contraseña</p>
        <p className="text-sm text-ink-secondary">
          Para cambiar tu contraseña, usá la opción de recuperación desde la pantalla de login.
        </p>
      </div>
    </div>
  )
}

// ─── Users tab (admin only) ────────────────────────────────────────────────────
function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [confirmUserPending, setConfirmUserPending] = useState<OrgUser | null>(null)
  const [users,   setUsers]   = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [search,  setSearch]  = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setUsers((await getUsers()).data) }
    catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally   { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (user: OrgUser) => {
    if (user.id === currentUserId) return
    setToggling(user.id)
    try {
      const updated = (await updateUser(user.id, { is_active: !user.is_active })).data
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, is_active: updated.is_active } : u))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al actualizar usuario')
    } finally { setToggling(null) }
  }

  const filtered = search
    ? users.filter(u =>
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

  if (loading) return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-3">
      {error && <ErrorAlert message={error} onRetry={load} />}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar usuario…"
        className="w-full h-9 px-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
      />

      <div className="card divide-y divide-surface-border overflow-hidden">
        {filtered.map(user => {
          const isMe = user.id === currentUserId
          return (
            <div key={user.id} className={clsx('flex items-center gap-3 px-4 py-3', !user.is_active && 'opacity-55')}>
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-surface-muted flex items-center justify-center text-sm font-600 text-ink-secondary shrink-0">
                {user.full_name[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-500 text-ink truncate">{user.full_name}</p>
                  {isMe && <span className="text-2xs text-ink-tertiary">(vos)</span>}
                  <Badge variant={ROLE_BADGE[user.role] ?? 'muted'} className="text-2xs shrink-0">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  {!user.is_active && (
                    <Badge variant="muted" className="text-2xs shrink-0">Inactivo</Badge>
                  )}
                </div>
                <p className="text-xs text-ink-tertiary truncate">{user.email}</p>
              </div>

              {/* Toggle active (admin, not self) */}
              {!isMe && (
                <button
                  onClick={() => handleToggle(user)}
                  disabled={toggling === user.id}
                  title={user.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                  className="shrink-0"
                >
                  {user.is_active
                    ? <ToggleRight className="w-5 h-5 text-brand" />
                    : <ToggleLeft className="w-5 h-5 text-ink-tertiary" />
                  }
                </button>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-4 text-sm text-ink-tertiary">Sin usuarios{search ? ` con "${search}"` : ''}.</p>
        )}
      </div>

      <p className="text-xs text-ink-tertiary">
        Para agregar nuevos usuarios, invitalos desde el panel de Supabase o contactá al soporte.
      </p>
      {confirmUserPending && (
        <ConfirmDialog
          title={confirmUserPending.is_active ? `¿Desactivar a ${confirmUserPending.full_name.split(' ')[0]}?` : `¿Activar a ${confirmUserPending.full_name.split(' ')[0]}?`}
          description={confirmUserPending.is_active
            ? `${confirmUserPending.full_name} perderá el acceso al sistema inmediatamente.`
            : `${confirmUserPending.full_name} podrá volver a iniciar sesión.`}
          confirmLabel={confirmUserPending.is_active ? 'Desactivar usuario' : 'Activar usuario'}
          variant={confirmUserPending.is_active ? 'danger' : 'default'}
          loading={toggling === confirmUserPending.id}
          onConfirm={async () => { await handleToggle(confirmUserPending); setConfirmUserPending(null) }}
          onCancel={() => setConfirmUserPending(null)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConfiguracionPage() {
  const [tab,    setTab]    = useState<Tab>('perfil')
  const [me,     setMe]     = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMe()
      .then(r => setMe(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isAdmin = me?.role === 'admin'

  const TABS = [
    { id: 'perfil' as Tab,   label: 'Mi perfil', icon: User     },
    ...(isAdmin ? [{ id: 'usuarios' as Tab, label: 'Usuarios', icon: Users }] : []),
  ]

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in">
      <div>
        <h1 className="text-base font-600 text-ink">Configuración</h1>
        <p className="text-xs text-ink-tertiary mt-0.5">Perfil y gestión de la organización</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0.5 bg-surface-muted p-1 rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-500 transition-colors',
              tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-secondary hover:text-ink'
            )}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-16 rounded-card" />
        </div>
      ) : me ? (
        <>
          {tab === 'perfil'   && <ProfileTab user={me} onUpdated={patch => setMe(prev => prev ? { ...prev, ...patch } : prev)} />}
          {tab === 'usuarios' && isAdmin && <UsersTab currentUserId={me.id} />}
        </>
      ) : (
        <ErrorAlert message="No se pudo cargar el perfil." />
      )}
    </div>
  )
}
