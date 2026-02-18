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

    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({
        tournaments: [],
        count: 0,
      })
    }

    // Optimisation : récupérer toutes les données en parallèle avec des requêtes groupées
    const tournamentIds = tournaments.map(t => t.id)
    const competitionIds = tournaments.map(t => t.competition_id).filter(Boolean)
    const customCompetitionIds = tournaments.map(t => t.custom_competition_id).filter(Boolean)
    const creatorIds = [...new Set(tournaments.map(t => t.creator_id))]

    const [
      allCompetitions,
      allCustomCompetitions,
      allProfiles,
      allParticipantsCounts,
      allCreatorPurchases,
      allParticipantPurchases,
      allCustomMatchdays,
      allImportedMatches,
      allLastPredictions
    ] = await Promise.all([
      // Récupérer toutes les compétitions standard
      competitionIds.length > 0 ? supabase
        .from('competitions')
        .select('id, name, emblem')
        .in('id', competitionIds)
        .then(r => r.data || []) : Promise.resolve([]),

      // Récupérer toutes les compétitions custom
      customCompetitionIds.length > 0 ? supabase
        .from('custom_competitions')
        .select('id, name, custom_emblem_color')
        .in('id', customCompetitionIds)
        .then(r => r.data || []) : Promise.resolve([]),

      // Récupérer tous les profils créateurs
      supabase
        .from('profiles')
        .select('id, username')
        .in('id', creatorIds)
        .then(r => r.data || []),

      // Compter les participants pour tous les tournois
      supabase
        .from('tournament_participants')
        .select('tournament_id')
        .in('tournament_id', tournamentIds)
        .then(r => r.data || []),

      // Récupérer tous les crédits créateurs
      supabase
        .from('tournament_purchases')
        .select('used_for_tournament_id, amount')
        .in('used_for_tournament_id', tournamentIds)
        .eq('used', true)
        .then(r => r.data || []),

      // Récupérer toutes les participations payantes
      supabase
        .from('tournament_purchases')
        .select('tournament_id, amount')
        .in('tournament_id', tournamentIds)
        .eq('used', true)
        .in('purchase_type', ['slot_invite', 'platinium_participation'])
        .then(r => r.data || []),

      // Récupérer les journées custom pour toutes les compétitions custom
      customCompetitionIds.length > 0 ? supabase
        .from('custom_competition_matchdays')
        .select('id, custom_competition_id')
        .in('custom_competition_id', customCompetitionIds)
        .then(r => r.data || []) : Promise.resolve([]),

      // Récupérer le dernier match par compétition (1 requête par compétition, chacune retourne 1 ligne)
      Promise.all(
        [...new Set(competitionIds)].map(cid =>
          supabase
            .from('imported_matches')
            .select('competition_id, utc_date')
            .eq('competition_id', cid)
            .not('utc_date', 'is', null)
            .order('utc_date', { ascending: false })
            .limit(1)
            .single()
            .then(r => r.data)
        )
      ).then(results => results.filter(Boolean)),

      // Récupérer le dernier pronostic par tournoi (1 requête par tournoi, chacune retourne 1 ligne)
      Promise.all(
        tournamentIds.map(tid =>
          supabase
            .from('predictions')
            .select('tournament_id, created_at')
            .eq('tournament_id', tid)
            .eq('is_default_prediction', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
            .then(r => r.data)
        )
      ).then(results => results.filter(Boolean))
    ])

    // Récupérer les matchs custom si nécessaire
    const customMatchdayIds = allCustomMatchdays.map((m: any) => m.id)
    const allCustomMatches = customMatchdayIds.length > 0 ? await supabase
      .from('custom_competition_matches')
      .select('custom_matchday_id, cached_utc_date')
      .in('custom_matchday_id', customMatchdayIds)
      .not('cached_utc_date', 'is', null)
      .order('cached_utc_date', { ascending: false })
      .then(r => r.data || []) : []

    // Créer des maps pour un accès rapide
    const competitionsMap = new Map(allCompetitions.map((c: any) => [c.id, { name: c.name, emblem: c.emblem }]))
    const customCompetitionsMap = new Map(allCustomCompetitions.map((c: any) => [c.id, { name: c.name, emblem: c.custom_emblem_color }]))
    const profilesMap = new Map(allProfiles.map((p: any) => [p.id, p.username]))

    const participantsCountMap = new Map<string, number>()
    allParticipantsCounts.forEach((p: any) => {
      participantsCountMap.set(p.tournament_id, (participantsCountMap.get(p.tournament_id) || 0) + 1)
    })

    const revenueMap = new Map<string, number>()
    allCreatorPurchases.forEach((p: any) => {
      revenueMap.set(p.used_for_tournament_id, (revenueMap.get(p.used_for_tournament_id) || 0) + (p.amount || 0))
    })
    allParticipantPurchases.forEach((p: any) => {
      revenueMap.set(p.tournament_id, (revenueMap.get(p.tournament_id) || 0) + (p.amount || 0))
    })

    const customMatchdayMap = new Map<number, number[]>()
    allCustomMatchdays.forEach((m: any) => {
      if (!customMatchdayMap.has(m.custom_competition_id)) {
        customMatchdayMap.set(m.custom_competition_id, [])
      }
      customMatchdayMap.get(m.custom_competition_id)!.push(m.id)
    })

    const lastMatchDateMap = new Map<number, string>()
    allImportedMatches.forEach((m: any) => {
      if (!lastMatchDateMap.has(m.competition_id)) {
        lastMatchDateMap.set(m.competition_id, m.utc_date)
      }
    })

    const customMatchesMap = new Map<number, string[]>()
    allCustomMatches.forEach((m: any) => {
      if (!customMatchesMap.has(m.custom_matchday_id)) {
        customMatchesMap.set(m.custom_matchday_id, [])
      }
      customMatchesMap.get(m.custom_matchday_id)!.push(m.cached_utc_date)
    })

    // Map du dernier pronostic par tournoi (premier trouvé = le plus récent grâce au order desc)
    const lastPredictionMap = new Map<string, string>()
    allLastPredictions.forEach((p: any) => {
      if (!lastPredictionMap.has(p.tournament_id)) {
        lastPredictionMap.set(p.tournament_id, p.created_at)
      }
    })

    // Construire les résultats
    const tournamentsWithCounts = tournaments.map((tournament: any) => {
      let competitionName = 'N/A'
      let competitionEmblem: string | null = null
      let competitionId = tournament.competition_id

      if (tournament.custom_competition_id) {
        const custom = customCompetitionsMap.get(tournament.custom_competition_id)
        competitionName = custom ? `Custom: ${custom.name}` : 'Custom'
        competitionEmblem = custom?.emblem || null
        competitionId = tournament.custom_competition_id
      } else if (tournament.competition_id) {
        const comp = competitionsMap.get(tournament.competition_id)
        competitionName = comp?.name || 'N/A'
        competitionEmblem = comp?.emblem || null
      }

      const creatorUsername = profilesMap.get(tournament.creator_id) || 'N/A'
      const participantsCount = participantsCountMap.get(tournament.id) || 0
      const totalRevenue = revenueMap.get(tournament.id) || 0

      let endDate: string | null = null
      if (tournament.custom_competition_id) {
        const matchdayIds = customMatchdayMap.get(tournament.custom_competition_id) || []
        const dates: string[] = []
        matchdayIds.forEach(mdId => {
          const mdDates = customMatchesMap.get(mdId) || []
          dates.push(...mdDates)
        })
        if (dates.length > 0) {
          endDate = dates.sort().reverse()[0]
        }
      } else if (tournament.competition_id) {
        endDate = lastMatchDateMap.get(tournament.competition_id) || null
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
        competition_emblem: competitionEmblem,
        created_at: tournament.created_at,
        creator_username: creatorUsername,
        participants_count: participantsCount,
        total_revenue: totalRevenue,
        end_date: endDate,
        last_prediction_at: lastPredictionMap.get(tournament.id) || null,
      }
    })

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
