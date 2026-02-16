import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Met à jour last_seen_at pour un utilisateur.
 * À appeler depuis les API routes après vérification de l'auth.
 * Non-bloquant : ne throw jamais, log silencieusement les erreurs.
 */
export function updateLastSeen(supabase: SupabaseClient, userId: string) {
  // Fire-and-forget : on n'attend pas le résultat
  supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) {
        console.error('[last_seen] Error updating:', error.message)
      }
    })
}
