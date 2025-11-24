import { createClient as createServerClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * API pour créer automatiquement des pronostics par défaut (0-0)
 * pour tous les matchs d'une journée où l'utilisateur n'a pas pronostiqué
 *
 * Usage:
 * POST /api/tournaments/{tournamentId}/create-default-predictions
 * Body: { userId: string, matchday: number }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { tournamentId } = await params
    const { userId, matchday } = await request.json()

    if (!userId || !matchday) {
      return NextResponse.json(
        { error: 'userId et matchday sont requis' },
        { status: 400 }
      )
    }

    // 1. Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('competition_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // 2. Récupérer tous les matchs de la journée du tournoi
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('matchday', matchday)

    if (matchesError || !matches) {
      return NextResponse.json(
        { error: 'Erreur lors de la récupération des matchs' },
        { status: 500 }
      )
    }

    // 3. Récupérer les pronostics existants de l'utilisateur pour cette journée
    const matchIds = matches.map(m => m.id)
    const { data: existingPredictions } = await supabase
      .from('predictions')
      .select('match_id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .in('match_id', matchIds)

    const existingMatchIds = new Set(existingPredictions?.map(p => p.match_id) || [])

    // 4. Créer des pronostics par défaut pour les matchs manquants
    const defaultPredictions = matches
      .filter(m => !existingMatchIds.has(m.id))
      .map(m => ({
        tournament_id: tournamentId,
        user_id: userId,
        match_id: m.id,
        predicted_home_score: 0,
        predicted_away_score: 0
      }))

    if (defaultPredictions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun pronostic par défaut à créer',
        created: 0
      })
    }

    // 5. Insérer les pronostics par défaut
    const { error: insertError } = await supabase
      .from('predictions')
      .insert(defaultPredictions)

    if (insertError) {
      console.error('Erreur lors de l\'insertion des pronostics par défaut:', insertError)
      return NextResponse.json(
        { error: 'Erreur lors de la création des pronostics par défaut' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${defaultPredictions.length} pronostic(s) par défaut créé(s)`,
      created: defaultPredictions.length
    })

  } catch (error: any) {
    console.error('Erreur dans create-default-predictions:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
