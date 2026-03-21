'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirectTo') ?? '/dashboard'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = getSupabaseClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Email o contraseña incorrectos.')
      setLoading(false)
      return
    }

    router.push(redirectTo)
  }

  return (
    <div className="min-h-dvh bg-surface-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
            <span className="text-white font-600 text-base">A</span>
          </div>
          <div>
            <p className="font-600 text-ink leading-tight">ADDING Seguros</p>
            <p className="text-xs text-ink-tertiary leading-tight">Plataforma operativa</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-6">
          <h1 className="text-base font-600 text-ink mb-1">Iniciar sesión</h1>
          <p className="text-sm text-ink-tertiary mb-6">Ingresá con tu cuenta ADDING</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-3.5 h-3.5" />}
              required
              autoComplete="email"
              autoFocus
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-3.5 h-3.5" />}
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-danger bg-danger-bg border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-tertiary mt-4">
          ADDING Seguros · Sistema interno
        </p>
      </div>
    </div>
  )
}
