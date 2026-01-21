import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const today = new Date().toISOString().split('T')[0]

    // OPTIMISATION: Exécuter TOUTES les requêtes initiales en parallèle
    const [
      competitionsResult,
      customCompetitionsResult,
      tournamentCountsResult
    ] = await Promise.all([
      // 1. Compétitions importées actives
      supabase
        .from('competitions')
        .select('*')
        .eq('is_active', true)
        .or(`current_season_end_date.is.null,current_season_end_date.gte.${today}`)
        .order('name'),

      // 2. Compétitions personnalisées actives (avec matchdays en une seule requête)
      supabase
        .from('custom_competitions')
        .select('*, custom_competition_matchdays(id, status)')
        .eq('is_active', true)
        .order('name'),

      // 3. Comptage des tournois par compétition (une seule requête agrégée)
      supabase
        .from('tournaments')
        .select('competition_id')
        .not('competition_id', 'is', null)
    ])

    const { data: competitions, error } = competitionsResult
    const { data: customCompetitions, error: customError } = customCompetitionsResult
    const { data: tournamentCounts } = tournamentCountsResult

    if (error) throw error
    if (customError) {
      console.error('Error fetching custom competitions:', customError)
    }

    // Créer un map des comptages de tournois par competition_id
    const tournamentCountMap: Record<number, number> = {}
    ;(tournamentCounts || []).forEach((t: any) => {
      tournamentCountMap[t.competition_id] = (tournamentCountMap[t.competition_id] || 0) + 1
    })

    // OPTIMISATION: Récupérer tous les matchs de toutes les compétitions en une seule requête
    const competitionIds = (competitions || []).map(c => c.id)
    const { data: allMatchesData } = competitionIds.length > 0
      ? await supabase
          .from('imported_matches')
          .select('competition_id, matchday, status, utc_date')
          .in('competition_id', competitionIds)
      : { data: [] }

    // Grouper les matchs par competition_id
    const matchesByCompetition: Record<number, any[]> = {}
    ;(allMatchesData || []).forEach((match: any) => {
      if (!matchesByCompetition[match.competition_id]) {
        matchesByCompetition[match.competition_id] = []
      }
      matchesByCompetition[match.competition_id].push(match)
    })

    // Calculer les stats pour chaque compétition (sans requêtes supplémentaires)
    const now = new Date()
    const competitionsWithStats = (competitions || []).map((comp) => {
      const allMatches = matchesByCompetition[comp.id] || []

      // Grouper les matchs par matchday
      const matchdayStats: Record<number, {
        total: number,
        finished: number,
        firstMatchDate: Date | null,
        allFinished: boolean
      }> = {}

      allMatches.forEach((match: any) => {
        if (!matchdayStats[match.matchday]) {
          matchdayStats[match.matchday] = {
            total: 0,
            finished: 0,
            firstMatchDate: null,
            allFinished: true
          }
        }
        matchdayStats[match.matchday].total++
        if (match.status === 'FINISHED') {
          matchdayStats[match.matchday].finished++
        } else {
          matchdayStats[match.matchday].allFinished = false
        }
        const matchDate = new Date(match.utc_date)
        if (!matchdayStats[match.matchday].firstMatchDate ||
            matchDate < matchdayStats[match.matchday].firstMatchDate!) {
          matchdayStats[match.matchday].firstMatchDate = matchDate
        }
      })

      const finishedMatchdaysCount = Object.values(matchdayStats)
        .filter(stats => stats.allFinished).length

      const startingMatchdaysCount = Object.values(matchdayStats)
        .filter(stats => {
          if (stats.allFinished) return false
          if (stats.firstMatchDate) {
            const hoursUntilMatch = (stats.firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            return hoursUntilMatch < 2
          }
          return false
        }).length

      const importedMatchdaysCount = Object.keys(matchdayStats).length
      const totalMatchdays = comp.total_matchdays || importedMatchdaysCount
      const remainingMatchdays = Math.max(0, totalMatchdays - finishedMatchdaysCount - startingMatchdaysCount)

      const remainingMatchdaysList = Object.entries(matchdayStats)
        .filter(([_, stats]) => {
          if (stats.allFinished) return false
          if (stats.firstMatchDate) {
            const hoursUntilMatch = (stats.firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            if (hoursUntilMatch < 2) return false
          }
          return true
        })
        .map(([matchday]) => parseInt(matchday))

      const remainingMatches = allMatches.filter(
        (m: any) => m.status !== 'FINISHED' && remainingMatchdaysList.includes(m.matchday)
      ).length

      return {
        ...comp,
        remaining_matchdays: remainingMatchdays,
        remaining_matches: remainingMatches,
        tournaments_count: tournamentCountMap[comp.id] || 0
      }
    })

    // Trier par popularité (nombre de tournois) décroissant
    competitionsWithStats.sort((a, b) => b.tournaments_count - a.tournaments_count)

    // Marquer la plus populaire
    if (competitionsWithStats.length > 0 && competitionsWithStats[0].tournaments_count > 0) {
      competitionsWithStats[0].is_most_popular = true
    }

    // Formater les compétitions personnalisées (matchdays déjà inclus via la requête)
    const customCompetitionsFormatted = (customCompetitions || []).map((customComp: any) => {
      // Compter les journées non terminées pour la page de création de tournoi
      const matchdays = customComp.custom_competition_matchdays || []
      const pendingMatchdays = matchdays.filter(
        (md: { id: string; status: string }) => md.status !== 'completed'
      ).length

      // Pour les compétitions custom (Best of Week), on utilise le nombre de journées en attente
      // Si aucune journée n'existe encore, on met une valeur par défaut de 10
      // Le flag hide_matchdays_badge permet de ne pas afficher le badge sur le vestiaire
      const remainingMatchdays = pendingMatchdays > 0 ? pendingMatchdays : 10

      return {
        id: `custom_${customComp.id}`,
        name: customComp.name,
        code: customComp.code,
        emblem: null,
        area_name: 'Best of Week',
        current_matchday: customComp.current_matchday || 1,
        current_season_start_date: customComp.created_at,
        current_season_end_date: null, // null pour éviter le calcul "saison terminée"
        is_active: customComp.is_active,
        remaining_matchdays: remainingMatchdays,
        remaining_matches: remainingMatchdays * (customComp.matches_per_matchday || 8),
        hide_matchdays_badge: true, // Ne pas afficher le badge sur le vestiaire
        tournaments_count: 0,
        is_most_popular: false,
        custom_emblem_white: customComp.custom_emblem_white ?? null,
        custom_emblem_color: customComp.custom_emblem_color ?? null,
        is_custom: true,
        custom_competition_id: customComp.id,
        competition_type: customComp.competition_type,
        matches_per_matchday: customComp.matches_per_matchday,
        season: customComp.season,
        description: customComp.description
      }
    })

    // Combiner les deux types de compétitions (personnalisées en premier)
    const allCompetitions = [...customCompetitionsFormatted, ...competitionsWithStats]

    return NextResponse.json({
      success: true,
      competitions: allCompetitions
    })
  } catch (error: any) {
    console.error('Error fetching active competitions:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
