import { redirect } from 'next/navigation'

// The canonical dashboard URL is /dashboard.
// Middleware and login both redirect to /dashboard.
// This page serves at / within the (dashboard) route group —
// redirect anyone landing here to the canonical URL.
export default function RootPage() {
  redirect('/dashboard')
}
