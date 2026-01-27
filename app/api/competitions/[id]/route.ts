import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Endpoint optimisé pour récupérer une seule compétition par ID
// Beaucoup plus rapide que /api/competitions/active qui charge toutes les compétitions

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier si c'est une compétition custom (id commence par "custom_")
    if (id.startsWith('custom_')) {
      const customId = id.replace('custom_', '')

      const { data: customComp, error } = await supabase
        .from('custom_competitions')
        .select('*, custom_competition_matchdays(id, status)')
        .eq('id', customId)
        .eq('is_active', true)
        .single()

      if (error || !customComp) {
        return NextResponse.json(
          { success: false, error: 'Compétition non trouvée' },
          { status: 404 }
        )
      }

      // Compter les journées non terminées
      const matchdays = customComp.custom_competition_matchdays || []
      const pendingMatchdays = matchdays.filter(
        (md: { id: string; status: string }) => md.status !== 'completed'
      ).length
      const remainingMatchdays = pendingMatchdays > 0 ? pendingMatchdays : 10

      return NextResponse.json({
        success: true,
        competition: {
          id: `custom_${customComp.id}`,
          name: customComp.name,
          code: customComp.code,
          emblem: null,
          area_name: 'Best of Week',
          current_matchday: customComp.current_matchday || 1,
          current_season_start_date: customComp.created_at,
          current_season_end_date: null,
          is_active: customComp.is_active,
          remaining_matchdays: remainingMatchdays,
          remaining_matches: remainingMatchdays * (customComp.matches_per_matchday || 8),
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
    }

    // Compétition importée standard
    const competitionId = parseInt(id)
    if (isNaN(competitionId)) {
      return NextResponse.json(
        { success: false, error: 'ID de compétition invalide' },
        { status: 400 }
      )
    }

    // Récupérer la compétition et ses matchs en parallèle
    const [compResult, matchesResult] = await Promise.all([
      supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('imported_matches')
        .select('matchday, status, utc_date, stage')
        .eq('competition_id', competitionId)
    ])

    if (compResult.error || !compResult.data) {
      return NextResponse.json(
        { success: false, error: 'Compétition non trouvée' },
        { status: 404 }
      )
    }

    const comp = compResult.data
    const allMatches = matchesResult.data || []
    const now = new Date()

    // Calculer les stats de matchdays par paire (stage, matchday)
    // Pour gérer les knockouts où le matchday redémarre à 1 par stage
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

    return NextResponse.json({
      success: true,
      competition: {
        ...comp,
        remaining_matchdays: remainingMatchdays,
        remaining_matches: remainingMatches
      }
    })
  } catch (error: any) {
    console.error('Error fetching competition:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
