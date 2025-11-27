import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'ID du tournoi manquant' },
        { status: 400 }
      )
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi introuvable' },
        { status: 404 }
      )
    }

    // Vérifier que le tournoi n'a pas encore commencé
    if (tournament.status !== 'pending' && tournament.status !== 'warmup') {
      return NextResponse.json(
        { success: false, error: 'Impossible de quitter un tournoi déjà commencé' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur n'est pas le capitaine
    if (tournament.creator_id === user.id) {
      return NextResponse.json(
        { success: false, error: 'Le capitaine doit d\'abord transférer le capitanat avant de quitter' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est bien participant
    const { data: participant, error: participantError } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: 'Vous ne participez pas à ce tournoi' },
        { status: 400 }
      )
    }

    // Supprimer le participant (avec admin pour bypass RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error removing participant:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la suppression' },
        { status: 500 }
      )
    }

    // Supprimer les pronostics de l'utilisateur pour ce tournoi
    await supabaseAdmin
      .from('predictions')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      message: 'Vous avez quitté le tournoi avec succès'
    })

  } catch (error: any) {
    console.error('Error leaving tournament:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
