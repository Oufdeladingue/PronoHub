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

      // 2. Compétitions personnalisées actives (avec matchdays et leurs matchs pour calculer les dates)
      supabase
        .from('custom_competitions')
        .select('*, custom_competition_matchdays(id, matchday_number, status, custom_competition_matches(cached_utc_date))')
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
    // On inclut 'stage' pour distinguer les journées de poule vs knockout
    const competitionIds = (competitions || []).map(c => c.id)
    const { data: allMatchesData } = competitionIds.length > 0
      ? await supabase
          .from('imported_matches')
          .select('competition_id, matchday, status, utc_date, stage')
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

      // Grouper les matchs par paire (stage, matchday) pour gérer les knockouts
      // où le matchday redémarre à 1 par stage (ex: CL, World Cup)
      const matchdayStats: Record<string, {
        total: number,
        finished: number,
        firstMatchDate: Date | null,
        allFinished: boolean
      }> = {}

      allMatches.forEach((match: any) => {
        const key = `${match.stage || 'REGULAR_SEASON'}_${match.matchday ?? 'KO'}`
        if (!matchdayStats[key]) {
          matchdayStats[key] = {
            total: 0,
            finished: 0,
            firstMatchDate: null,
            allFinished: true
          }
        }
        matchdayStats[key].total++
        if (match.status === 'FINISHED') {
          matchdayStats[key].finished++
        } else {
          matchdayStats[key].allFinished = false
        }
        const matchDate = new Date(match.utc_date)
        if (!matchdayStats[key].firstMatchDate ||
            matchDate < matchdayStats[key].firstMatchDate!) {
          matchdayStats[key].firstMatchDate = matchDate
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

      const remainingMatchdayKeys = Object.entries(matchdayStats)
        .filter(([_, stats]) => {
          if (stats.allFinished) return false
          if (stats.firstMatchDate) {
            const hoursUntilMatch = (stats.firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            if (hoursUntilMatch < 2) return false
          }
          return true
        })
        .map(([key]) => key)

      const remainingMatches = allMatches.filter(
        (m: any) => {
          const key = `${m.stage || 'REGULAR_SEASON'}_${m.matchday}`
          return m.status !== 'FINISHED' && remainingMatchdayKeys.includes(key)
        }
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
    // Calculer la date de clôture (30 min avant le premier match jouable)
    const now = new Date()
    const closingBuffer = 30 * 60 * 1000 // 30 minutes en ms
    const closingTime = new Date(now.getTime() + closingBuffer).toISOString()

    const customCompetitionsFormatted = (customCompetitions || []).map((customComp: any) => {
      // Compter les journées RÉELLEMENT jouables basées sur les dates des matchs
      const matchdays = customComp.custom_competition_matchdays || []

      // Calculer le nombre de journées où au moins un match est encore jouable
      let playableMatchdays = 0
      let firstPlayableMatchdayNumber: number | null = null

      for (const md of matchdays) {
        const matches = md.custom_competition_matches || []
        // Une journée est jouable si au moins un match a une date future (avec buffer 30min)
        const hasPlayableMatch = matches.some((m: any) => m.cached_utc_date && m.cached_utc_date > closingTime)

        if (hasPlayableMatch) {
          playableMatchdays++
          if (firstPlayableMatchdayNumber === null) {
            firstPlayableMatchdayNumber = md.matchday_number
          }
        }
      }

      // Fallback: si aucune journée trouvée par les dates, utiliser le statut
      if (playableMatchdays === 0) {
        playableMatchdays = matchdays.filter(
          (md: { id: string; status: string }) => md.status !== 'completed'
        ).length
      }

      // Pour les compétitions custom (Best of Week), on utilise le nombre de journées jouables
      // Si aucune journée n'existe encore, on met une valeur par défaut de 10
      // Le flag hide_matchdays_badge permet de ne pas afficher le badge sur le vestiaire
      const remainingMatchdays = playableMatchdays > 0 ? playableMatchdays : 10

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
