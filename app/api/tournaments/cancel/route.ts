import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'ID du tournoi requis' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Vérifier l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté' },
        { status: 401 }
      )
    }

    // Récupérer le tournoi et vérifier que l'utilisateur est le capitaine
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, creator_id, tournament_type, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournoi introuvable' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur est le capitaine
    if (tournament.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Seul le capitaine peut annuler le tournoi' },
        { status: 403 }
      )
    }

    // Vérifier que le tournoi n'est pas déjà terminé
    if (tournament.status === 'completed') {
      return NextResponse.json(
        { error: 'Impossible d\'annuler un tournoi terminé' },
        { status: 400 }
      )
    }

    // Restaurer le crédit si le tournoi est annulé AVANT d'avoir commencé (status = pending ou warmup)
    // et qu'il s'agit d'un tournoi payant
    let creditRestored = false
    if (['pending', 'warmup'].includes(tournament.status) && ['oneshot', 'elite', 'platinium'].includes(tournament.tournament_type)) {
      // Trouver l'achat lié à ce tournoi
      const { data: purchase, error: purchaseError } = await supabase
        .from('tournament_purchases')
        .select('id, purchase_type, tournament_subtype')
        .eq('used_for_tournament_id', tournamentId)
        .eq('used', true)
        .single()

      if (!purchaseError && purchase) {
        // Restaurer le crédit (marquer comme non utilisé)
        const { error: restoreError } = await supabase
          .from('tournament_purchases')
          .update({
            used: false,
            used_at: null,
            used_for_tournament_id: null,
            tournament_id: null
          })
          .eq('id', purchase.id)

        if (restoreError) {
          console.error('Error restoring credit:', restoreError)
        } else {
          creditRestored = true
          console.log(`[CREDIT RESTORED] Purchase ${purchase.id} (${purchase.purchase_type}/${purchase.tournament_subtype}) restored for user ${user.id}`)
        }
      }
    }

    // 1. Supprimer d'abord tous les participants du tournoi
    const { error: participantsError } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)

    if (participantsError) {
      console.error('Error deleting participants:', participantsError)
      // Continuer quand même, la suppression du tournoi peut fonctionner avec CASCADE
    }

    // 2. Supprimer les pronostics liés au tournoi (si existants)
    const { error: predictionsError } = await supabase
      .from('predictions')
      .delete()
      .eq('tournament_id', tournamentId)

    if (predictionsError) {
      console.error('Error deleting predictions:', predictionsError)
      // Continuer quand même
    }

    // 3. Supprimer le tournoi lui-même
    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)

    if (deleteError) {
      console.error('Error deleting tournament:', deleteError)
      return NextResponse.json(
        { error: 'Erreur lors de la suppression du tournoi' },
        { status: 500 }
      )
    }

    // Log pour le suivi
    console.log(`[TOURNAMENT CANCELLED] Tournament "${tournament.name}" (${tournamentId}) cancelled by user ${user.id}. Type: ${tournament.tournament_type}. Credit restored: ${creditRestored}`)

    return NextResponse.json({
      success: true,
      message: creditRestored
        ? 'Tournoi annulé avec succès. Votre crédit a été restauré.'
        : 'Tournoi annulé avec succès',
      tournamentType: tournament.tournament_type,
      creditRestored
    })

  } catch (error: any) {
    console.error('Error in cancel tournament route:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
