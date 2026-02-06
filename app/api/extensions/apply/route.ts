import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { extensionType, tournamentId, options } = body as {
      extensionType: 'duration_extension' | 'player_extension'
      tournamentId: string
      options?: { journeysToAdd?: number }
    }

    if (!extensionType || !tournamentId) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est créateur du tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('creator_id, max_players, players_extended, matchdays_count, max_matchdays')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    if (tournament.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Vous devez être créateur du tournoi' },
        { status: 403 }
      )
    }

    // Consommer un crédit d'extension
    const { data: creditResult, error: creditError } = await supabase
      .rpc('use_purchase_credit', {
        p_user_id: user.id,
        p_purchase_type: extensionType,
        p_tournament_id: tournamentId
      })
      .single()

    if (creditError || !creditResult) {
      return NextResponse.json(
        { error: 'Aucun crédit disponible' },
        { status: 400 }
      )
    }

    // Appliquer l'extension selon le type
    if (extensionType === 'duration_extension') {
      const journeysToAdd = options?.journeysToAdd || 10

      // Mettre à jour le tournoi
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          max_matchdays: tournament.max_matchdays
            ? tournament.max_matchdays + journeysToAdd
            : (tournament.matchdays_count || 0) + journeysToAdd,
          duration_extended: true
        })
        .eq('id', tournamentId)

      if (updateError) {
        console.error('Erreur mise à jour tournoi:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de l\'application de l\'extension' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `${journeysToAdd} journées ajoutées avec succès`
      })

    } else if (extensionType === 'player_extension') {
      // Ajouter +5 places
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          max_players: tournament.max_players + 5,
          max_participants: tournament.max_players + 5,
          players_extended: (tournament.players_extended || 0) + 5
        })
        .eq('id', tournamentId)

      if (updateError) {
        console.error('Erreur mise à jour tournoi:', updateError)
        return NextResponse.json(
          { error: 'Erreur lors de l\'application de l\'extension' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: '5 places ajoutées avec succès'
      })
    }

    return NextResponse.json(
      { error: 'Type d\'extension non reconnu' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Erreur application extension:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'application de l\'extension' },
      { status: 500 }
    )
  }
}
