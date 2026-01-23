import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createCapacitorStorage, isCapacitor } from '@/lib/capacitor'

let capacitorClient: ReturnType<typeof createSupabaseClient> | null = null

// Flag global pour savoir si la session a été restaurée
// Ce flag est set par CapacitorSessionProvider
if (typeof window !== 'undefined') {
  (window as any).__capacitorSessionRestored = false
}

/**
 * Fetch wrapper qui ajoute automatiquement le token d'authentification
 * pour les appels API dans Capacitor (où les cookies ne sont pas envoyés)
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)

  // Si on est dans Capacitor, ajouter le token Bearer
  if (typeof window !== 'undefined' && isCapacitor()) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    }
  }

  return fetch(url, {
    ...options,
    headers,
    // Inclure les credentials pour le web (cookies)
    credentials: 'include',
  })
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration incomplete')
  }

  // Dans Capacitor, utiliser le client avec stockage persistant
  if (typeof window !== 'undefined' && isCapacitor()) {
    if (!capacitorClient) {
      capacitorClient = createSupabaseClient(supabaseUrl, supabaseKey, {
        auth: {
          storage: createCapacitorStorage(),
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    }
    return capacitorClient
  }

  // Sur le web, utiliser le client SSR standard
  return createBrowserClient(supabaseUrl, supabaseKey)
}
