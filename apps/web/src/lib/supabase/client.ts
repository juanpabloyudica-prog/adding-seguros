import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  )
}

// Singleton for client components
let client: ReturnType<typeof createSupabaseBrowserClient> | null = null

export function getSupabaseClient() {
  if (!client) client = createSupabaseBrowserClient()
  return client
}
