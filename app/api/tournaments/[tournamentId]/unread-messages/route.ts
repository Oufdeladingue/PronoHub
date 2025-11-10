import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer le nombre de messages non lus
export async function GET(
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

    // Récupérer le statut de lecture
    const { data: readStatus } = await supabase
      .from('message_read_status')
      .select('last_read_at')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .single()

    // Si pas de statut de lecture, compter tous les messages
    const lastReadAt = readStatus?.last_read_at || '1970-01-01T00:00:00Z'

    // Compter les messages non lus (après la dernière lecture)
    const { count, error: countError } = await supabase
      .from('tournament_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .gt('created_at', lastReadAt)
      .neq('user_id', user.id) // Exclure ses propres messages

    if (countError) {
      console.error('Error counting unread messages:', countError)
      return NextResponse.json({ error: 'Erreur lors du comptage des messages' }, { status: 500 })
    }

    return NextResponse.json({ unreadCount: count || 0 })
  } catch (error) {
    console.error('Error in GET /api/tournaments/[tournamentId]/unread-messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
