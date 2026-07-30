import { createAdminClient } from '@/lib/supabase/server'

export interface FeaturedPublicTournament {
  slug: string
  name: string
  competition_name: string | null
  players: number
}

/** Le tournoi public en cours à mettre en avant (le plus récent, non terminé). null si aucun. */
export async function getFeaturedPublicTournament(): Promise<FeaturedPublicTournament | null> {
  try {
    const s = createAdminClient()
    const { data: t } = await s
      .from('tournaments')
      .select('id, slug, name, competition_name')
      .eq('is_public', true)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!t) return null
    const { count } = await s
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', t.id)
    return { slug: t.slug, name: t.name, competition_name: t.competition_name, players: count || 0 }
  } catch {
    return null
  }
}
