import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationToUser } from '@/lib/notifications'

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

    // Récupérer les statuts de lecture de tous les participants (sauf l'utilisateur courant)
    const { data: readStatuses } = await supabase
      .from('message_read_status')
      .select(`
        user_id,
        last_read_at,
        profiles:user_id (
          username,
          avatar
        )
      `)
      .eq('tournament_id', tournamentId)
      .neq('user_id', user.id) // Exclure l'utilisateur courant

    // Formater les messages avec les lecteurs
    const formattedMessages = messages?.map(msg => {
      // Trouver qui a lu ce message (ceux dont last_read_at >= created_at du message)
      const readers = readStatuses?.filter(status =>
        new Date(status.last_read_at) >= new Date(msg.created_at)
      ).map(status => ({
        user_id: status.user_id,
        username: (status.profiles as any)?.username || 'Inconnu',
        avatar: (status.profiles as any)?.avatar || 'avatar1'
      })) || []

      return {
        id: msg.id,
        message: msg.message,
        created_at: msg.created_at,
        user_id: msg.user_id,
        username: (msg.profiles as any)?.username || 'Inconnu',
        avatar: (msg.profiles as any)?.avatar || 'avatar1',
        readers // Liste des lecteurs pour ce message
      }
    }) || []

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

    // Détecter les mentions (@username) et envoyer des notifications
    // Regex qui capture les lettres, chiffres, underscore ET apostrophes
    const mentionRegex = /@([\w']+)/g
    const mentions = [...message.matchAll(mentionRegex)].map(match => match[1])

    console.log('[MENTION DEBUG] Message content:', message)
    console.log('[MENTION DEBUG] Mentions detected:', mentions)

    if (mentions.length > 0) {
      // Récupérer le nom du tournoi, compétition et l'auteur du message
      const { data: tournament } = await supabase
        .from('tournaments')
        .select(`
          name,
          slug,
          competition_id,
          custom_competition_id,
          competitions:competition_id (name),
          custom_competitions:custom_competition_id (name)
        `)
        .eq('id', tournamentId)
        .single()

      const senderUsername = (newMessage.profiles as any)?.username || 'Un joueur'
      const competitionName = (tournament?.competitions as any)?.name
        || (tournament?.custom_competitions as any)?.name
        || undefined

      console.log('[MENTION DEBUG] Tournament:', tournament)
      console.log('[MENTION DEBUG] Sender username:', senderUsername)
      console.log('[MENTION DEBUG] Competition name:', competitionName)

      // Récupérer les participants du tournoi avec leurs usernames
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select(`
          user_id,
          profiles:user_id (
            username
          )
        `)
        .eq('tournament_id', tournamentId)

      console.log('[MENTION DEBUG] Participants fetched:', participants?.length || 0)
      console.log('[MENTION DEBUG] Participants usernames:', participants?.map(p => (p.profiles as any)?.username))

      // Pour chaque mention, envoyer une notification
      for (const mentionedUsername of mentions) {
        console.log('[MENTION DEBUG] Processing mention for:', mentionedUsername)

        // Trouver l'utilisateur mentionné parmi les participants
        const mentionedUser = participants?.find(
          p => (p.profiles as any)?.username?.toLowerCase() === mentionedUsername.toLowerCase()
        )

        console.log('[MENTION DEBUG] Mentioned user found:', mentionedUser)
        console.log('[MENTION DEBUG] Is self-mention?', mentionedUser?.user_id === user.id)

        if (mentionedUser && mentionedUser.user_id !== user.id) {
          // Ne pas notifier l'auteur du message
          console.log('[MENTION DEBUG] Sending notification to user_id:', mentionedUser.user_id)
          try {
            const result = await sendNotificationToUser(
              mentionedUser.user_id,
              'mention',
              {
                body: `${senderUsername} t'a mentionné dans ${tournament?.name || 'le tournoi'}`,
                tournamentSlug: tournament?.slug || '',
                data: {
                  username: senderUsername,
                  tournamentName: tournament?.name || 'le tournoi',
                  competitionName: competitionName,
                  message: message.substring(0, 200) // Limiter la longueur (200 chars pour l'email)
                }
              }
            )
            console.log('[MENTION DEBUG] Notification sent successfully:', result)
          } catch (notifError) {
            console.error(`[MENTION DEBUG] Erreur envoi notification mention pour ${mentionedUsername}:`, notifError)
            // Ne pas bloquer l'envoi du message si la notification échoue
          }
        } else {
          console.log('[MENTION DEBUG] Skipped notification for:', mentionedUsername, '(user not found or self-mention)')
        }
      }
    }

    return NextResponse.json({ message: formattedMessage }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/tournaments/[tournamentId]/messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Marquer les messages comme lus
export async function PUT(
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

    // Mettre à jour ou créer le statut de lecture
    const { error: upsertError } = await supabase
      .from('message_read_status')
      .upsert({
        tournament_id: tournamentId,
        user_id: user.id,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: 'tournament_id,user_id'
      })

    if (upsertError) {
      console.error('Error updating read status:', upsertError)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour du statut de lecture' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/tournaments/[tournamentId]/messages:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
