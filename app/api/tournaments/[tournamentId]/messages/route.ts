import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Récupérer les messages du tournoi
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

    // Récupérer les messages avec les informations des utilisateurs
    const { data: messages, error: messagesError } = await supabase
      .from('tournament_messages')
      .select(`
        id,
        message,
        created_at,
        user_id,
        profiles:user_id (
          username,
          avatar
        )
      `)
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: true })
      .limit(100) // Limiter à 100 derniers messages

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des messages' }, { status: 500 })
    }

    // Formater les messages
    const formattedMessages = messages?.map(msg => ({
      id: msg.id,
      message: msg.message,
      created_at: msg.created_at,
      user_id: msg.user_id,
      username: (msg.profiles as any)?.username || 'Inconnu',
      avatar: (msg.profiles as any)?.avatar || 'avatar1'
    })) || []

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error('Error in GET /api/tournaments/[tournamentId]/messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Envoyer un nouveau message
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

    // Récupérer le message depuis le body
    const body = await request.json()
    const { message } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Le message ne peut pas être vide' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Le message est trop long (max 500 caractères)' }, { status: 400 })
    }

    // Insérer le message
    const { data: newMessage, error: insertError } = await supabase
      .from('tournament_messages')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        message: message.trim()
      })
      .select(`
        id,
        message,
        created_at,
        user_id,
        profiles:user_id (
          username,
          avatar
        )
      `)
      .single()

    if (insertError) {
      console.error('Error inserting message:', insertError)
      return NextResponse.json({ error: 'Erreur lors de l\'envoi du message' }, { status: 500 })
    }

    // Formater le message
    const formattedMessage = {
      id: newMessage.id,
      message: newMessage.message,
      created_at: newMessage.created_at,
      user_id: newMessage.user_id,
      username: (newMessage.profiles as any)?.username || 'Inconnu',
      avatar: (newMessage.profiles as any)?.avatar || 'avatar1'
    }

    return NextResponse.json({ message: formattedMessage }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/tournaments/[tournamentId]/messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
