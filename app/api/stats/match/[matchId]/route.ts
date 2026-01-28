import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TeamFormMatch {
  matchId: string
  utcDate: string
  opponentName: string
  opponentCrest: string | null
  isHome: boolean
  goalsFor: number
  goalsAgainst: number
  result: 'W' | 'D' | 'L'
}

interface PredictionTrends {
  totalPredictions: number
  homeWin: { count: number; percentage: number }
  draw: { count: number; percentage: number }
  awayWin: { count: number; percentage: number }
}

interface StatsResponse {
  homeTeamForm: TeamFormMatch[]
  awayTeamForm: TeamFormMatch[]
  predictionTrends: PredictionTrends | null
  homeTeamName: string
  awayTeamName: string
}

/**
 * GET /api/stats/match/[matchId]?tournamentId=xxx&competitionId=yyy&homeTeamId=hhh&awayTeamId=aaa&homeTeamName=xxx&awayTeamName=yyy
 * Retourne les stats du match: forme des équipes + tendances de pronostics
 *
 * Note: L'accès doit être vérifié en amont via /api/stats/access
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const supabase = await createClient()
    const { matchId } = await params
    const { searchParams } = new URL(request.url)

    const tournamentId = searchParams.get('tournamentId')
    const competitionId = searchParams.get('competitionId')
    const homeTeamId = searchParams.get('homeTeamId')
    const awayTeamId = searchParams.get('awayTeamId')
    const homeTeamName = searchParams.get('homeTeamName') || 'Équipe domicile'
    const awayTeamName = searchParams.get('awayTeamName') || 'Équipe extérieur'

    if (!matchId || !tournamentId || !competitionId || !homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { error: 'Missing required parameters: tournamentId, competitionId, homeTeamId, awayTeamId' },
        { status: 400 }
      )
    }

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Exécuter les 3 queries en parallèle
    const [homeFormResult, awayFormResult, trendsResult] = await Promise.all([
      // Forme équipe domicile (5 derniers matchs terminés dans la compétition)
      supabase
        .from('imported_matches')
        .select('id, utc_date, home_team_id, home_team_name, home_team_crest, away_team_id, away_team_name, away_team_crest, home_score, away_score')
        .eq('competition_id', parseInt(competitionId))
        .eq('status', 'FINISHED')
        .or(`home_team_id.eq.${homeTeamId},away_team_id.eq.${homeTeamId}`)
        .order('utc_date', { ascending: false })
        .limit(5),

      // Forme équipe extérieur (5 derniers matchs terminés dans la compétition)
      supabase
        .from('imported_matches')
        .select('id, utc_date, home_team_id, home_team_name, home_team_crest, away_team_id, away_team_name, away_team_crest, home_score, away_score')
        .eq('competition_id', parseInt(competitionId))
        .eq('status', 'FINISHED')
        .or(`home_team_id.eq.${awayTeamId},away_team_id.eq.${awayTeamId}`)
        .order('utc_date', { ascending: false })
        .limit(5),

      // Tendances pronostics (sur TOUS les tournois)
      supabase
        .from('predictions')
        .select('predicted_home_score, predicted_away_score')
        .eq('match_id', matchId)
    ])

    // Transformer les résultats de forme équipe
    const transformTeamForm = (matches: any[], teamId: number): TeamFormMatch[] => {
      return (matches || []).map(match => {
        const isHome = match.home_team_id === teamId
        const goalsFor = isHome ? match.home_score : match.away_score
        const goalsAgainst = isHome ? match.away_score : match.home_score
        const opponentName = isHome ? match.away_team_name : match.home_team_name
        const opponentCrest = isHome ? match.away_team_crest : match.home_team_crest

        let result: 'W' | 'D' | 'L'
        if (goalsFor > goalsAgainst) result = 'W'
        else if (goalsFor < goalsAgainst) result = 'L'
        else result = 'D'

        return {
          matchId: match.id,
          utcDate: match.utc_date,
          opponentName,
          opponentCrest,
          isHome,
          goalsFor,
          goalsAgainst,
          result
        }
      })
    }

    const homeTeamForm = transformTeamForm(homeFormResult.data || [], parseInt(homeTeamId))
    const awayTeamForm = transformTeamForm(awayFormResult.data || [], parseInt(awayTeamId))

    // Calculer les tendances de pronostics
    let predictionTrends: PredictionTrends | null = null
    const predictions = trendsResult.data || []

    if (predictions.length >= 5) {
      let homeWinCount = 0
      let drawCount = 0
      let awayWinCount = 0

      for (const pred of predictions) {
        if (pred.predicted_home_score > pred.predicted_away_score) {
          homeWinCount++
        } else if (pred.predicted_home_score === pred.predicted_away_score) {
          drawCount++
        } else {
          awayWinCount++
        }
      }

      const total = predictions.length
      predictionTrends = {
        totalPredictions: total,
        homeWin: {
          count: homeWinCount,
          percentage: Math.round((homeWinCount / total) * 100)
        },
        draw: {
          count: drawCount,
          percentage: Math.round((drawCount / total) * 100)
        },
        awayWin: {
          count: awayWinCount,
          percentage: Math.round((awayWinCount / total) * 100)
        }
      }
    }

    return NextResponse.json({
      homeTeamForm,
      awayTeamForm,
      predictionTrends,
      homeTeamName,
      awayTeamName
    } as StatsResponse)

  } catch (error) {
    console.error('Error fetching match stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
