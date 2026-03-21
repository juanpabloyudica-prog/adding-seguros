'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { ToastProvider } from '@/components/ui/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-surface-subtle">
        {/* Sidebar */}
        <Sidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        {/* Main area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <TopBar onMenuClick={() => setMobileOpen(true)} />

          {/* Scrollable page content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
