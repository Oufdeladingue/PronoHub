import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createCapacitorStorage, isCapacitor } from '@/lib/capacitor'

let capacitorClient: ReturnType<typeof createSupabaseClient> | null = null

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
