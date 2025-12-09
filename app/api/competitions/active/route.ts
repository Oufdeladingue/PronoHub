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

    // Récupérer les compétitions importées actives dont la saison n'est pas terminée
    const today = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
    const { data: competitions, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('is_active', true)
      .or(`current_season_end_date.is.null,current_season_end_date.gte.${today}`)
      .order('name')

    // Récupérer les compétitions personnalisées actives
    const { data: customCompetitions, error: customError } = await supabase
      .from('custom_competitions')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    if (customError) {
      console.error('Error fetching custom competitions:', customError)
    }

    // Récupérer les matchdays séparément pour chaque compétition custom
    const customCompetitionsWithMatchdays = await Promise.all(
      (customCompetitions || []).map(async (comp) => {
        const { data: matchdays, error: matchdaysError } = await supabase
          .from('custom_competition_matchdays')
          .select('id, status')
          .eq('custom_competition_id', comp.id)

        if (matchdaysError) {
          console.error('Error fetching matchdays for', comp.name, ':', matchdaysError)
        }

        return {
          ...comp,
          custom_competition_matchdays: matchdays || []
        }
      })
    )

    // Pour chaque compétition, compter les journées restantes et la popularité
    const competitionsWithStats = await Promise.all(
      (competitions || []).map(async (comp) => {
        const now = new Date()

        // Récupérer tous les matchdays distincts avec leur statut
        const { data: allMatches } = await supabase
          .from('imported_matches')
          .select('matchday, status, utc_date')
          .eq('competition_id', comp.id)
          .order('matchday', { ascending: true })

        // Grouper les matchs par matchday
        const matchdayStats: Record<number, {
          total: number,
          finished: number,
          firstMatchDate: Date | null,
          allFinished: boolean
        }> = {}

        ;(allMatches || []).forEach((match: any) => {
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
          // Garder la date du premier match
          const matchDate = new Date(match.utc_date)
          if (!matchdayStats[match.matchday].firstMatchDate ||
              matchDate < matchdayStats[match.matchday].firstMatchDate!) {
            matchdayStats[match.matchday].firstMatchDate = matchDate
          }
        })

        // Compter les journées terminées (tous les matchs finis)
        const finishedMatchdaysCount = Object.values(matchdayStats)
          .filter(stats => stats.allFinished).length

        // Compter les journées en cours ou imminentes (commencent dans moins de 2h)
        const startingMatchdaysCount = Object.values(matchdayStats)
          .filter(stats => {
            if (stats.allFinished) return false
            if (stats.firstMatchDate) {
              const hoursUntilMatch = (stats.firstMatchDate.getTime() - now.getTime()) / (1000 * 60 * 60)
              return hoursUntilMatch < 2
            }
            return false
          }).length

        // Total des matchdays dans la base de données
        const importedMatchdaysCount = Object.keys(matchdayStats).length

        // Utiliser total_matchdays de la compétition si disponible (inclut les phases knockout pas encore importées)
        // Sinon, utiliser le nombre de matchdays importés
        const totalMatchdays = comp.total_matchdays || importedMatchdaysCount

        // Journées restantes = total - terminées - en cours/imminentes
        // Si des phases knockout ne sont pas encore importées, elles seront comptées via total_matchdays
        const remainingMatchdays = Math.max(0, totalMatchdays - finishedMatchdaysCount - startingMatchdaysCount)

        // Compter les matchs restants (non terminés et pas imminents)
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

        const remainingMatches = (allMatches || []).filter(
          (m: any) => m.status !== 'FINISHED' && remainingMatchdaysList.includes(m.matchday)
        ).length

        // Compter le nombre de tournois utilisant cette compétition
        const { count: tournamentsCount } = await supabase
          .from('tournaments')
          .select('*', { count: 'exact', head: true })
          .eq('competition_id', comp.id)

        return {
          ...comp,
          remaining_matchdays: remainingMatchdays,
          remaining_matches: remainingMatches,
          tournaments_count: tournamentsCount || 0
        }
      })
    )

    // Trier par popularité (nombre de tournois) décroissant
    competitionsWithStats.sort((a, b) => b.tournaments_count - a.tournaments_count)

    // Marquer la plus populaire
    if (competitionsWithStats.length > 0 && competitionsWithStats[0].tournaments_count > 0) {
      competitionsWithStats[0].is_most_popular = true
    }

    // Formater les compétitions personnalisées
    const customCompetitionsFormatted = customCompetitionsWithMatchdays.map(customComp => {
      // Compter uniquement les journées restantes (statut différent de 'completed' et 'active')
      // Status dans la DB: 'draft', 'pending', 'active', 'completed'
      const allMatchdays = customComp.custom_competition_matchdays || []
      const remainingMatchdays = allMatchdays.filter(
        (md: { id: string; status: string }) => md.status !== 'completed' && md.status !== 'active'
      ).length

      // Pour les compétitions personnalisées, on utilise le nombre de journées restantes
      return {
        id: `custom_${customComp.id}`,
        name: customComp.name,
        code: customComp.code,
        emblem: null,
        area_name: 'Best of Week',
        current_matchday: customComp.current_matchday || 1,
        current_season_start_date: customComp.created_at,
        current_season_end_date: customComp.created_at,
        is_active: customComp.is_active,
        remaining_matchdays: remainingMatchdays,
        remaining_matches: remainingMatchdays * (customComp.matches_per_matchday || 8),
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
