import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateBonusMatch } from '@/lib/scoring'

// Fonction helper pour créer un bonus match pour une journée donnée
async function createBonusMatchForMatchday(
  supabase: any,
  tournament: any,
  matchday: number
): Promise<string | null> {
  const isCustomCompetition = !!tournament.custom_competition_id
  let matchIds: string[] = []

  if (isCustomCompetition) {
    // TOURNOI CUSTOM - Récupérer les matchs via custom_competition_matches
    const { data: matchdayData } = await supabase
      .from('custom_competition_matchdays')
      .select('id')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .eq('matchday_number', matchday)
      .single()

    if (!matchdayData) return null

    const { data: customMatches } = await supabase
      .from('custom_competition_matches')
      .select('football_data_match_id')
      .eq('custom_matchday_id', matchdayData.id)

    if (!customMatches || customMatches.length === 0) return null

    const footballDataIds = customMatches
      .map((m: any) => m.football_data_match_id)
      .filter((id: any) => id !== null)

    if (footballDataIds.length === 0) return null

    const { data: importedMatches } = await supabase
      .from('imported_matches')
      .select('id')
      .in('football_data_match_id', footballDataIds)

    if (!importedMatches || importedMatches.length === 0) return null

    matchIds = importedMatches.map((m: any) => m.id)
  } else {
    // TOURNOI STANDARD
    const { data: matchesOfDay } = await supabase
      .from('imported_matches')
      .select('id')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    if (!matchesOfDay || matchesOfDay.length === 0) return null

    matchIds = matchesOfDay.map((m: any) => m.id)
  }

  // Générer et insérer le match bonus
  const selectedMatchId = generateBonusMatch(tournament.id, matchday, matchIds)

  const { data: bonusMatch, error } = await supabase
    .from('tournament_bonus_matches')
    .insert({
      tournament_id: tournament.id,
      matchday,
      match_id: selectedMatchId
    })
    .select()
    .single()

  if (error) {
    console.error(`Erreur création bonus match J${matchday}:`, error)
    return null
  }

  return bonusMatch?.match_id || null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const matchday = searchParams.get('matchday')

    const { tournamentId } = await params

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Vérifier si les matchs bonus sont activés
    if (!tournament.bonus_match) {
      return NextResponse.json({ bonusMatches: [] })
    }

    // Récupérer les bonus matches existants
    const { data: existingBonusMatches, error: bonusError } = await supabase
      .from('tournament_bonus_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('matchday', { ascending: true })

    console.log('[BONUS API] Tournament ID:', tournamentId)
    console.log('[BONUS API] Existing bonus matches:', existingBonusMatches?.length || 0)
    if (bonusError) console.error('[BONUS API] Error fetching bonus matches:', bonusError)

    const existingMatchdays = new Set(existingBonusMatches?.map((bm: any) => bm.matchday) || [])

    // Déterminer les journées du tournoi
    let matchdaysToCheck: number[] = []
    const isCustomCompetition = !!tournament.custom_competition_id

    if (isCustomCompetition) {
      // Récupérer les journées de la compétition custom
      const { data: customMatchdays } = await supabase
        .from('custom_competition_matchdays')
        .select('matchday_number')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .order('matchday_number', { ascending: true })

      matchdaysToCheck = customMatchdays?.map((md: any) => md.matchday_number) || []
    } else {
      // Générer les journées basées sur starting/ending matchday ou num_matchdays
      const startMatchday = tournament.starting_matchday || 1
      const endMatchday = tournament.ending_matchday || (tournament.num_matchdays || 10)
      matchdaysToCheck = Array.from(
        { length: endMatchday - startMatchday + 1 },
        (_, i) => startMatchday + i
      )
    }

    // Créer les bonus matches manquants
    const newBonusMatches: any[] = []
    for (const md of matchdaysToCheck) {
      if (!existingMatchdays.has(md)) {
        const matchId = await createBonusMatchForMatchday(supabase, tournament, md)
        if (matchId) {
          newBonusMatches.push({ tournament_id: tournamentId, matchday: md, match_id: matchId })
        }
      }
    }

    // Combiner existants et nouveaux
    const allBonusMatches = [...(existingBonusMatches || []), ...newBonusMatches]
      .sort((a, b) => a.matchday - b.matchday)

    console.log('[BONUS API] Total bonus matches to return:', allBonusMatches.length)

    // Si une journée spécifique est demandée
    if (matchday) {
      const bonusMatch = allBonusMatches.find((bm: any) => bm.matchday === parseInt(matchday))
      return NextResponse.json({ bonusMatch })
    }

    return NextResponse.json({ bonusMatches: allBonusMatches })

  } catch (error: any) {
    console.error('Erreur lors de la récupération des matchs bonus:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { tournamentId } = await params
    const { matchday } = await request.json()

    if (!matchday) {
      return NextResponse.json({ error: 'La journée est requise' }, { status: 400 })
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Vérifier si les matchs bonus sont activés
    if (!tournament.bonus_match) {
      return NextResponse.json({ error: 'Les matchs bonus ne sont pas activés pour ce tournoi' }, { status: 400 })
    }

    // Vérifier si un match bonus existe déjà pour cette journée
    const { data: existingBonus } = await supabase
      .from('tournament_bonus_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('matchday', matchday)
      .single()

    if (existingBonus) {
      return NextResponse.json({ bonusMatch: existingBonus })
    }

    // Récupérer tous les matchs de cette journée
    let matchIds: string[] = []
    const isCustomCompetition = !!tournament.custom_competition_id

    if (isCustomCompetition) {
      // TOURNOI CUSTOM - Récupérer les matchs via custom_competition_matches
      // D'abord récupérer l'ID du matchday custom
      const { data: matchdayData } = await supabase
        .from('custom_competition_matchdays')
        .select('id')
        .eq('custom_competition_id', tournament.custom_competition_id)
        .eq('matchday_number', matchday)
        .single()

      if (!matchdayData) {
        return NextResponse.json({ error: 'Journée non trouvée pour cette compétition custom' }, { status: 404 })
      }

      // Récupérer les matchs custom de cette journée
      const { data: customMatches, error: customMatchesError } = await supabase
        .from('custom_competition_matches')
        .select('football_data_match_id')
        .eq('custom_matchday_id', matchdayData.id)

      if (customMatchesError || !customMatches || customMatches.length === 0) {
        return NextResponse.json({ error: 'Aucun match trouvé pour cette journée' }, { status: 404 })
      }

      // Récupérer les IDs de imported_matches via football_data_match_id
      const footballDataIds = customMatches
        .map(m => m.football_data_match_id)
        .filter(id => id !== null)

      if (footballDataIds.length === 0) {
        return NextResponse.json({ error: 'Aucun match importé trouvé pour cette journée' }, { status: 404 })
      }

      const { data: importedMatches, error: importedError } = await supabase
        .from('imported_matches')
        .select('id')
        .in('football_data_match_id', footballDataIds)

      if (importedError || !importedMatches || importedMatches.length === 0) {
        return NextResponse.json({ error: 'Aucun match importé trouvé pour cette journée' }, { status: 404 })
      }

      matchIds = importedMatches.map(m => m.id)
    } else {
      // TOURNOI STANDARD - Récupérer les matchs depuis imported_matches
      const { data: matchesOfDay, error: matchesError } = await supabase
        .from('imported_matches')
        .select('id')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', matchday)

      if (matchesError || !matchesOfDay || matchesOfDay.length === 0) {
        return NextResponse.json({ error: 'Aucun match trouvé pour cette journée' }, { status: 404 })
      }

      matchIds = matchesOfDay.map(m => m.id)
    }

    // Générer un match bonus aléatoire (mais reproductible)
    const selectedMatchId = generateBonusMatch(tournamentId, matchday, matchIds)

    // Insérer le match bonus
    const { data: bonusMatch, error: insertError } = await supabase
      .from('tournament_bonus_matches')
      .insert({
        tournament_id: tournamentId,
        matchday,
        match_id: selectedMatchId
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: 'Erreur lors de la création du match bonus' }, { status: 500 })
    }

    return NextResponse.json({ bonusMatch })

  } catch (error: any) {
    console.error('Erreur lors de la création du match bonus:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error.message },
      { status: 500 }
    )
  }
}
