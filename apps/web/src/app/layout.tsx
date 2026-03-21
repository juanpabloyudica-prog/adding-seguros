import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s · ADDING Seguros', default: 'ADDING Seguros' },
  description: 'Plataforma operativa de broker de seguros',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
