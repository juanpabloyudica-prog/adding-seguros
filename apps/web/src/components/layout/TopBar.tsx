'use client'

import { usePathname } from 'next/navigation'
import { Menu, LogOut, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { getSupabaseClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

// ─── Route → title map ────────────────────────────────────────────────────────
const ROUTE_TITLES: Record<string, string> = {
  '/mi-dia':                 'Mi día',
  '/dashboard':              'Dashboard',
  '/personas':               'Personas',
  '/polizas':                'Pólizas',
  '/polizas/vencimientos':   'Vencimientos',
  '/gestiones':              'Gestiones',
  '/conversaciones':         'Conversaciones',
  '/companias':              'Compañías',
  '/documentos':             'Documentos',
  '/cotizaciones':           'Cotizaciones',
  '/configuracion':          'Configuración',
  '/automatizaciones':       'Automatizaciones',
}

function getTitle(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // Dynamic route: /personas/[id]
  if (pathname === '/gestiones/nueva')       return 'Nuevo caso'
  if (pathname.startsWith('/personas/'))     return 'Detalle de persona'
  if (pathname === '/cotizaciones/nueva')     return 'Nueva cotización'
  if (pathname === '/personas/nueva')          return 'Nueva persona'
  if (pathname.startsWith('/cotizaciones/'))  return 'Detalle de cotización'
  if (pathname.startsWith('/polizas/') && !pathname.includes('vencimientos')) return 'Detalle de póliza'
  if (pathname.startsWith('/companias/')) return 'Compañía'
  if (pathname.startsWith('/gestiones/')) return 'Detalle de gestión'
  if (pathname.startsWith('/conversaciones/')) return 'Conversación'
  return 'ADDING Seguros'
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
}

// ─── UserMenu ─────────────────────────────────────────────────────────────────
function UserMenu({ email, name }: { email?: string; name?: string }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const signOut = async () => {
    await getSupabaseClient().auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm',
          'hover:bg-surface-muted transition-colors duration-100',
          'focus-visible:focus-ring'
        )}
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-600 shrink-0">
          {getInitials(name)}
        </div>
        <span className="hidden sm:block text-ink-secondary text-xs max-w-[120px] truncate">
          {name ?? email}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-ink-tertiary hidden sm:block" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-52 card shadow-dropdown py-1 animate-fade-in">
            <div className="px-3 py-2 border-b border-surface-border">
              <p className="text-xs font-500 text-ink truncate">{name}</p>
              <p className="text-2xs text-ink-tertiary truncate">{email}</p>
            </div>
            <button
              onClick={signOut}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-secondary hover:bg-surface-muted hover:text-danger transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────
interface TopBarProps {
  onMenuClick: () => void
  actions?: React.ReactNode
}

export function TopBar({ onMenuClick, actions }: TopBarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const title = getTitle(pathname)
  const name  = user?.user_metadata?.['full_name'] as string | undefined

  return (
    <header className="h-14 bg-surface border-b border-surface-border flex items-center px-4 gap-3 shrink-0">

      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 rounded-lg text-ink-secondary hover:bg-surface-muted transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <h1 className="text-sm font-600 text-ink flex-1 truncate">{title}</h1>

      {/* Slot for page-level actions */}
      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {/* User menu */}
      <UserMenu email={user?.email} name={name} />
    </header>
  )
}
