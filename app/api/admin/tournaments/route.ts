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
      .select('id, name, slug, status, competition_id, custom_competition_id, created_at, creator_id, tournament_type')
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
        let competitionName = 'N/A'
        let competitionId = tournament.competition_id

        // Récupérer le nom de la compétition (standard ou custom)
        if (tournament.custom_competition_id) {
          // Compétition custom
          const { data: customCompetition } = await supabase
            .from('custom_competitions')
            .select('name')
            .eq('id', tournament.custom_competition_id)
            .single()
          competitionName = customCompetition?.name ? `Custom: ${customCompetition.name}` : 'Custom'
          competitionId = tournament.custom_competition_id
        } else if (tournament.competition_id) {
          // Compétition importée standard
          const { data: competition } = await supabase
            .from('competitions')
            .select('name')
            .eq('id', tournament.competition_id)
            .single()
          competitionName = competition?.name || 'N/A'
        }

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

        // Calculer le gain total du tournoi (crédit créateur + participations payantes)
        let totalRevenue = 0

        // Crédit créateur utilisé pour ce tournoi
        const { data: creatorPurchase } = await supabase
          .from('tournament_purchases')
          .select('amount')
          .eq('used_for_tournament_id', tournament.id)
          .eq('used', true)
          .single()
        if (creatorPurchase?.amount) {
          totalRevenue += creatorPurchase.amount
        }

        // Participations payantes (slot_invite, platinium_participation)
        const { data: participantPurchases } = await supabase
          .from('tournament_purchases')
          .select('amount')
          .eq('tournament_id', tournament.id)
          .eq('used', true)
          .in('purchase_type', ['slot_invite', 'platinium_participation'])
        if (participantPurchases) {
          totalRevenue += participantPurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)
        }

        // Récupérer la date de fin prévue (dernier match du tournoi)
        let endDate: string | null = null

        if (tournament.custom_competition_id) {
          // Tournoi custom : récupérer les journées puis les matchs
          const { data: matchdays } = await supabase
            .from('custom_competition_matchdays')
            .select('id')
            .eq('custom_competition_id', tournament.custom_competition_id)

          if (matchdays && matchdays.length > 0) {
            const matchdayIds = matchdays.map((m: any) => m.id)
            const { data: customMatches } = await supabase
              .from('custom_competition_matches')
              .select('cached_utc_date')
              .in('custom_matchday_id', matchdayIds)
              .not('cached_utc_date', 'is', null)
              .order('cached_utc_date', { ascending: false })
              .limit(1)
            if (customMatches && customMatches.length > 0) {
              endDate = customMatches[0].cached_utc_date
            }
          }
        } else if (tournament.competition_id) {
          // Tournoi standard : récupérer le dernier match importé
          const { data: lastMatch } = await supabase
            .from('imported_matches')
            .select('utc_date')
            .eq('competition_id', tournament.competition_id)
            .not('utc_date', 'is', null)
            .order('utc_date', { ascending: false })
            .limit(1)
          if (lastMatch && lastMatch.length > 0) {
            endDate = lastMatch[0].utc_date
          }
        }

        return {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          tournament_type: tournament.tournament_type || 'free',
          competition_id: competitionId,
          custom_competition_id: tournament.custom_competition_id,
          competition_name: competitionName,
          created_at: tournament.created_at,
          creator_username: creator?.username || 'N/A',
          participants_count: participantsCount || 0,
          total_revenue: totalRevenue,
          end_date: endDate,
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
