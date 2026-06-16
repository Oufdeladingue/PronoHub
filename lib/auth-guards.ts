import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Helpers d'autorisation pour les routes API.
 *
 * RAPPEL : le middleware ne protège PAS les routes /api/** — chaque route doit s'auto-protéger.
 * Beaucoup de routes utilisent le client service-role (bypass RLS) → un contrôle applicatif
 * est indispensable. Ces helpers centralisent le schéma cookie web / Bearer Capacitor.
 *
 * Usage :
 *   const guard = await requireSuperAdmin()
 *   if (guard.response) return guard.response
 *   // ... guard.user / guard.supabase disponibles
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type GuardResult =
  | { user: null; supabase: null; response: NextResponse }
  | { user: { id: string; email?: string }; supabase: SupabaseServerClient; response: null }

/** Exige un utilisateur authentifié (cookie web ou Bearer Capacitor). */
export async function requireUser(): Promise<GuardResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, supabase: null, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  return { user, supabase, response: null }
}

/** Exige un utilisateur authentifié ET super admin. */
export async function requireSuperAdmin(): Promise<GuardResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, supabase: null, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') {
    return { user: null, supabase: null, response: NextResponse.json({ error: 'Accès refusé - Super admin requis' }, { status: 403 }) }
  }
  return { user, supabase, response: null }
}
