import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * API pour récupérer les informations du match qui a déclenché le déblocage d'un trophée
 * GET /api/user/trophy-unlock-info?trophyType=king_of_day&unlockedAt=2024-01-15T10:30:00Z
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const trophyType = searchParams.get('trophyType')
    const unlockedAt = searchParams.get('unlockedAt')

    if (!trophyType || !unlockedAt) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Convertir la date de déblocage en timestamp
    const unlockDate = new Date(unlockedAt)

    // Stratégie : trouver le dernier match terminé avant la date de déblocage
    // qui correspond au type de trophée

    let match = null

    // Pour la plupart des trophées, on cherche le dernier match terminé avant le déblocage
    // Exception : certains trophées nécessitent de chercher dans les predictions ou journeys

    // SIMPLIFICATION: Utiliser TOUJOURS le fallback qui fonctionne
    // Chercher directement le dernier match importé terminé avant le unlock
    const { data: importedMatches, error: matchError } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('status', 'FINISHED')
      .lte('utc_date', unlockDate.toISOString())
      .order('utc_date', { ascending: false })
      .limit(1)

    if (matchError) {
      console.error('[trophy-unlock-info] Erreur SQL:', matchError)
      throw matchError
    }

    if (importedMatches && importedMatches.length > 0) {
      match = {
        home_team_name: importedMatches[0].home_team_name || 'Équipe',
        away_team_name: importedMatches[0].away_team_name || 'Équipe',
        home_team_crest: importedMatches[0].home_team_crest,
        away_team_crest: importedMatches[0].away_team_crest,
        competition_id: importedMatches[0].competition_id,
        home_score: importedMatches[0].home_score,
        away_score: importedMatches[0].away_score
      }
    }

    if (!match) {
      return NextResponse.json({
        success: false,
        error: 'Match déclencheur non trouvé'
      })
    }

    return NextResponse.json({
      success: true,
      match: {
        homeTeamName: match.home_team_name,
        awayTeamName: match.away_team_name,
        homeTeamCrest: match.home_team_crest,
        awayTeamCrest: match.away_team_crest,
        competitionId: match.competition_id,
        homeScore: match.home_score,
        awayScore: match.away_score
      }
    })
  } catch (error: any) {
    console.error('Error in trophy-unlock-info route:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

// Fonctions helper pour trouver le bon match selon le type de trophée

async function findLastBonusMatch(supabase: any, userId: string, unlockDate: Date) {
  // Chercher le dernier match bonus prédit par l'utilisateur avant le déblocage
  const { data } = await supabase
    .from('predictions')
    .select(`
      match_id,
      tournament_id,
      tournaments!inner (
        competition_id,
        custom_competition_id
      )
    `)
    .eq('user_id', userId)
    .eq('is_bonus_match', true)
    .lte('created_at', unlockDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) return null

  const prediction = data[0]
  // Récupérer les détails du match
  return await getMatchDetails(supabase, prediction.match_id, prediction.tournaments)
}

async function findLastTournamentMatch(supabase: any, userId: string, unlockDate: Date) {
  // Chercher les tournois où l'utilisateur participe qui se sont terminés juste avant le déblocage
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select(`
      tournament_id,
      tournaments!inner (
        id,
        status,
        competition_id,
        custom_competition_id
      )
    `)
    .eq('user_id', userId)
    .eq('tournaments.status', 'finished')

  if (!participations || participations.length === 0) return null

  // Prendre le premier tournoi terminé
  const tournament = participations[0].tournaments

  // Récupérer le dernier match du tournoi
  if (tournament.custom_competition_id) {
    // Compétition custom
    const { data: matchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('id')
      .eq('custom_competition_id', tournament.custom_competition_id)

    if (!matchdays) return null

    const matchdayIds = matchdays.map((m: any) => m.id)

    const { data: lastMatches } = await supabase
      .from('custom_competition_matches')
      .select('*')
      .in('custom_matchday_id', matchdayIds)
      .eq('status', 'FINISHED')
      .order('cached_utc_date', { ascending: false })
      .limit(1)

    if (!lastMatches || lastMatches.length === 0) return null

    const lastMatch = lastMatches[0]

    return {
      home_team_name: lastMatch.home_team_name,
      away_team_name: lastMatch.away_team_name,
      home_team_crest: lastMatch.home_team_crest,
      away_team_crest: lastMatch.away_team_crest,
      competition_id: tournament.custom_competition_id
    }
  } else {
    // Compétition importée
    const { data: lastMatches } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', tournament.competition_id)
      .eq('status', 'FINISHED')
      .order('utc_date', { ascending: false })
      .limit(1)

    if (!lastMatches || lastMatches.length === 0) return null

    const lastMatch = lastMatches[0]

    // Les noms et logos sont directement dans la table imported_matches
    return {
      home_team_name: lastMatch.home_team_name || 'Équipe',
      away_team_name: lastMatch.away_team_name || 'Équipe',
      home_team_crest: lastMatch.home_team_crest,
      away_team_crest: lastMatch.away_team_crest,
      competition_id: tournament.competition_id
    }
  }
}

async function findLastMatchdayMatch(supabase: any, userId: string, unlockDate: Date) {
  // Chercher le dernier match prédit qui s'est terminé avant le déblocage
  // Augmenter la limite pour gérer les matchs orphelins
  const { data: predictions } = await supabase
    .from('predictions')
    .select(`
      match_id,
      tournament_id,
      tournaments!inner (
        competition_id,
        custom_competition_id
      )
    `)
    .eq('user_id', userId)
    .lte('created_at', unlockDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(50) // Augmenter pour avoir plus de chances de trouver un match valide

  if (!predictions || predictions.length === 0) return null

  // Parcourir les predictions pour trouver un match terminé
  for (const pred of predictions) {
    try {
      const matchDetails = await getMatchDetails(supabase, pred.match_id, pred.tournaments)
      // getMatchDetails peut retourner null si le match n'existe plus
      if (!matchDetails) {
        continue
      }

      // Vérifier si le match est terminé
      const isFinished = await isMatchFinished(supabase, pred.match_id, pred.tournaments)
      if (isFinished) {
        return matchDetails
      }
    } catch (error) {
      // Si erreur sur ce match, passer au suivant
      continue
    }
  }

  return null
}

async function findLastPredictedMatch(supabase: any, userId: string, unlockDate: Date) {
  // D'abord essayer avec les predictions (peut avoir des matchs orphelins)
  const matchFromPredictions = await findLastMatchdayMatch(supabase, userId, unlockDate)
  if (matchFromPredictions) {
    return matchFromPredictions
  }

  // Fallback: chercher directement dans tous les matchs terminés importés avant le unlock
  // pour gérer le cas où toutes les predictions pointent vers des matchs custom supprimés
  const { data: importedMatches, error } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('status', 'FINISHED')
    .lte('utc_date', unlockDate.toISOString())
    .order('utc_date', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[trophy-unlock-info] Erreur SQL fallback:', error)
    throw error
  }

  if (!importedMatches || importedMatches.length === 0) {
    return null
  }

  const match = importedMatches[0]

  // Les noms et logos sont directement dans la table imported_matches
  const result = {
    home_team_name: match.home_team_name || 'Équipe',
    away_team_name: match.away_team_name || 'Équipe',
    home_team_crest: match.home_team_crest,
    away_team_crest: match.away_team_crest,
    competition_id: match.competition_id
  }

  return result
}

// Helper pour récupérer les détails d'un match
async function getMatchDetails(supabase: any, matchId: string, tournament: any) {
  if (tournament.custom_competition_id) {
    // Match custom
    const { data: matches } = await supabase
      .from('custom_competition_matches')
      .select('*')
      .eq('id', matchId)
      .limit(1)

    if (!matches || matches.length === 0) return null

    const match = matches[0]

    return {
      home_team_name: match.home_team_name,
      away_team_name: match.away_team_name,
      home_team_crest: match.home_team_crest,
      away_team_crest: match.away_team_crest,
      competition_id: tournament.custom_competition_id
    }
  } else {
    // Match importé
    const { data: matches } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('id', matchId)
      .limit(1)

    if (!matches || matches.length === 0) return null

    const match = matches[0]

    // Les noms et logos sont directement dans la table imported_matches
    return {
      home_team_name: match.home_team_name || 'Équipe',
      away_team_name: match.away_team_name || 'Équipe',
      home_team_crest: match.home_team_crest,
      away_team_crest: match.away_team_crest,
      competition_id: tournament.competition_id
    }
  }
}

// Helper pour vérifier si un match est terminé
async function isMatchFinished(supabase: any, matchId: string, tournament: any): Promise<boolean> {
  if (tournament.custom_competition_id) {
    const { data } = await supabase
      .from('custom_competition_matches')
      .select('status')
      .eq('id', matchId)
      .limit(1)

    return data && data.length > 0 && data[0].status === 'FINISHED'
  } else {
    const { data } = await supabase
      .from('imported_matches')
      .select('status')
      .eq('id', matchId)
      .limit(1)

    return data && data.length > 0 && data[0].status === 'FINISHED'
  }
}
