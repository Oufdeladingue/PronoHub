import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateLastSeen } from '@/lib/update-last-seen'

const VALID_EMOJIS = ['🔥', '🏆', '😂', '👏', '🎯', '😢', '😡']

// POST - Toggle une réaction sur un message (ajoute si absente, supprime si présente)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const supabase = await createClient()
    const { tournamentId } = await params

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est participant du tournoi
    const { data: participant, error: participantError } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Vous devez être participant du tournoi' }, { status: 403 })
    }

    // Tracker l'activité (fire-and-forget)
    updateLastSeen(supabase, user.id)

    // Récupérer les données depuis le body
    const body = await request.json()
    const { messageId, emoji } = body

    if (!messageId) {
      return NextResponse.json({ error: 'messageId requis' }, { status: 400 })
    }

    if (!emoji || !VALID_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: 'Emoji invalide' }, { status: 400 })
    }

    // Vérifier que le message appartient bien à ce tournoi
    const { data: message, error: messageError } = await supabase
      .from('tournament_messages')
      .select('id')
      .eq('id', messageId)
      .eq('tournament_id', tournamentId)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
    }

    // Vérifier si la réaction existe déjà
    const { data: existingReaction } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .single()

    if (existingReaction) {
      // Supprimer la réaction existante
      const { error: deleteError } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existingReaction.id)

      if (deleteError) {
        console.error('Error deleting reaction:', deleteError)
        return NextResponse.json({ error: 'Erreur lors de la suppression de la réaction' }, { status: 500 })
      }

      return NextResponse.json({ action: 'removed', emoji })
    } else {
      // Ajouter la nouvelle réaction
      const { error: insertError } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji
        })

      if (insertError) {
        console.error('Error inserting reaction:', insertError)
        return NextResponse.json({ error: 'Erreur lors de l\'ajout de la réaction' }, { status: 500 })
      }

      return NextResponse.json({ action: 'added', emoji })
    }
  } catch (error) {
    console.error('Error in POST /api/tournaments/[tournamentId]/messages/reactions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
