import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateBonusMatch } from '@/lib/scoring'

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

    // Si une journée spécifique est demandée
    if (matchday) {
      const { data: bonusMatch } = await supabase
        .from('tournament_bonus_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('matchday', parseInt(matchday))
        .single()

      return NextResponse.json({ bonusMatch })
    }

    // Sinon, récupérer tous les matchs bonus du tournoi
    const { data: bonusMatches } = await supabase
      .from('tournament_bonus_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('matchday', { ascending: true })

    return NextResponse.json({ bonusMatches })

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
    const { data: matchesOfDay, error: matchesError } = await supabase
      .from('imported_matches')
      .select('id')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    if (matchesError || !matchesOfDay || matchesOfDay.length === 0) {
      return NextResponse.json({ error: 'Aucun match trouvé pour cette journée' }, { status: 404 })
    }

    // Générer un match bonus aléatoire (mais reproductible)
    const matchIds = matchesOfDay.map(m => m.id)
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
