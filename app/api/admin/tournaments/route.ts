import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Récupérer tous les tournois
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('id, name, slug, status, competition_id, created_at, creator_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tournaments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tournaments' },
        { status: 500 }
      )
    }

    // Récupérer les données supplémentaires pour chaque tournoi
    const tournamentsWithCounts = await Promise.all(
      tournaments.map(async (tournament: any) => {
        // Récupérer le nom de la compétition
        const { data: competition } = await supabase
          .from('competitions')
          .select('name')
          .eq('id', tournament.competition_id)
          .single()

        // Récupérer le username du créateur
        const { data: creator } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', tournament.creator_id)
          .single()

        // Compter les participants
        const { count: participantsCount } = await supabase
          .from('tournament_participants')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournament.id)

        // Compter les pronostics
        const { count: predictionsCount } = await supabase
          .from('predictions')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', tournament.id)

        return {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          competition_id: tournament.competition_id,
          competition_name: competition?.name || 'N/A',
          created_at: tournament.created_at,
          creator_username: creator?.username || 'N/A',
          participants_count: participantsCount || 0,
          predictions_count: predictionsCount || 0,
        }
      })
    )

    return NextResponse.json({
      tournaments: tournamentsWithCounts,
      count: tournamentsWithCounts.length,
    })
  } catch (error: any) {
    console.error('Error in tournaments route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
