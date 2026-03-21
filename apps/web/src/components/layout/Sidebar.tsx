'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard, Users, FileText, FolderOpen, AlertTriangle,
  MessageSquare, Building2, Settings, ChevronLeft, ChevronRight, X, Shield, Sun, Zap
} from 'lucide-react'

// ─── Nav definition ───────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/mi-dia',                 icon: Sun,             label: 'Mi día' },
  { href: '/personas',               icon: Users,           label: 'Personas' },
  { href: '/polizas',                icon: Shield,          label: 'Pólizas' },
  { href: '/polizas/vencimientos',   icon: AlertTriangle,   label: 'Vencimientos' },
  { href: '/gestiones',              icon: FolderOpen,      label: 'Gestiones' },
  { href: '/cotizaciones',           icon: FileText,        label: 'Cotizaciones' },
  { href: '/conversaciones',         icon: MessageSquare,   label: 'Conversaciones' },
  { href: '/automatizaciones',       icon: Zap,             label: 'Automatizaciones' },
  { href: '/companias',              icon: Building2,       label: 'Compañías' },
  { href: '/documentos',             icon: FileText,        label: 'Documentos' },
] as const

const NAV_BOTTOM = [
  { href: '/configuracion', icon: Settings, label: 'Configuración' },
] as const

// ─── Unread count hook (lightweight poll) ─────────────────────────────────────
function useUnreadCount() {
  const [count, setCount] = useState(0)

  const fetch_ = useCallback(async () => {
    try {
      const { apiGet } = await import('@/lib/api/client')
      const res = await apiGet<{ total?: number; data?: unknown[] }>(
        '/api/conversations',
        { unread_only: 'true', limit: '1' }
      )
      setCount((res as { total?: number }).total ?? 0)
    } catch { /* silent — unread badge is non-critical */ }
  }, [])

  useEffect(() => {
    fetch_()
    const id = setInterval(fetch_, 30_000)
    return () => clearInterval(id)
  }, [fetch_])

  return count
}

// ─── NavItem ─────────────────────────────────────────────────────────────────
function NavItem({
  href, icon: Icon, label, collapsed, onClick, badge = 0,
}: {
  href: string
  icon: React.ElementType
  label: string
  collapsed: boolean
  onClick?: () => void
  badge?: number
}) {
  const pathname  = usePathname()
  // Active if exact match or starts with href (for nested routes)
  // But don't over-match '/polizas' on '/polizas/vencimientos' as both active
  // Active if exact match, OR if current path is a sub-route AND the nav item is a direct parent (not a sibling sub-route)
  const isExact      = pathname === href
  const isParent     = href !== '/dashboard' && pathname.startsWith(href + '/') && !NAV_ITEMS.some((n) => n.href !== href && pathname.startsWith(n.href + '/') && n.href.startsWith(href + '/'))
  const isActive     = isExact || isParent

  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={clsx(
        'flex items-center rounded-lg px-2.5 py-2 gap-2.5 text-sm transition-colors duration-100',
        'focus-visible:focus-ring',
        isActive
          ? 'bg-brand/10 text-brand font-500'
          : 'text-ink-secondary hover:bg-surface-muted hover:text-ink'
      )}
    >
      <span className="relative shrink-0">
        <Icon className={clsx(collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand rounded-full border border-surface animate-pulse" />
        )}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
interface SidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const unreadConversations         = useUnreadCount()

  // Persist collapsed state in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo / Brand */}
      <div className={clsx(
        'flex items-center gap-2.5 px-3 border-b border-surface-border',
        'h-14 shrink-0'
      )}>
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-600">A</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-600 text-ink leading-tight truncate">ADDING</p>
            <p className="text-2xs text-ink-tertiary leading-tight">Seguros</p>
          </div>
        )}
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="ml-auto lg:hidden text-ink-tertiary hover:text-ink p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed}
            onClick={onMobileClose}
            badge={item.href === '/conversaciones' ? unreadConversations : 0} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="py-3 px-2 border-t border-surface-border space-y-0.5">
        {NAV_BOTTOM.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} onClick={onMobileClose} />
        ))}
      </div>

      {/* Collapse toggle — desktop only */}
      <button
        onClick={toggleCollapsed}
        className={clsx(
          'hidden lg:flex items-center justify-center h-9 mx-2 mb-2',
          'rounded-lg text-ink-tertiary hover:bg-surface-muted hover:text-ink',
          'transition-colors duration-100 text-xs gap-1.5'
        )}
      >
        {collapsed
          ? <><ChevronRight className="w-3.5 h-3.5" /></>
          : <><ChevronLeft className="w-3.5 h-3.5" /><span>Colapsar</span></>
        }
      </button>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col bg-surface border-r border-surface-border',
          'transition-all duration-200 ease-in-out shrink-0',
          collapsed ? 'w-[64px]' : 'w-[240px]'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[240px] bg-surface border-r border-surface-border',
          'flex flex-col lg:hidden transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
