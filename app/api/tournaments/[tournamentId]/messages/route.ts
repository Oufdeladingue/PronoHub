import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotificationToUser } from '@/lib/notifications'
import { checkMessage } from '@/lib/profanity-filter'
import { updateLastSeen } from '@/lib/update-last-seen'

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

    // Récupérer les messages avec les informations des utilisateurs, réponses et réactions
    const { data: messages, error: messagesError } = await supabase
      .from('tournament_messages')
      .select(`
        id,
        message,
        created_at,
        user_id,
        reply_to_id,
        profiles:user_id (
          username,
          avatar
        ),
        reply_to:reply_to_id (
          id,
          message,
          user_id,
          profiles:user_id (
            username
          )
        ),
        reactions:message_reactions (
          emoji,
          user_id,
          profiles:user_id (
            username
          )
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

    // Formater les messages avec les lecteurs, réponses et réactions
    const formattedMessages = messages?.map(msg => {
      // Trouver qui a lu ce message (ceux dont last_read_at >= created_at du message)
      // Exclure aussi l'auteur du message (pas de sens de montrer "X a lu le message de X")
      const readers = readStatuses?.filter(status =>
        new Date(status.last_read_at) >= new Date(msg.created_at) &&
        status.user_id !== msg.user_id
      ).map(status => ({
        user_id: status.user_id,
        username: (status.profiles as any)?.username || 'Inconnu',
        avatar: (status.profiles as any)?.avatar || 'avatar1'
      })) || []

      // Agréger les réactions par emoji
      const reactionsRaw = (msg as any).reactions || []
      const reactionsByEmoji = reactionsRaw.reduce((acc: any, reaction: any) => {
        const emoji = reaction.emoji
        if (!acc[emoji]) {
          acc[emoji] = { emoji, count: 0, users: [], userIds: [] }
        }
        acc[emoji].count++
        acc[emoji].users.push((reaction.profiles as any)?.username || 'Inconnu')
        acc[emoji].userIds.push(reaction.user_id)
        return acc
      }, {} as Record<string, { emoji: string; count: number; users: string[]; userIds: string[] }>)

      const reactions = Object.values(reactionsByEmoji).map((r: any) => ({
        emoji: r.emoji,
        count: r.count,
        users: r.users,
        hasReacted: r.userIds.includes(user.id)
      }))

      // Formater la réponse (reply_to)
      const replyTo = (msg as any).reply_to ? {
        id: (msg as any).reply_to.id,
        message: (msg as any).reply_to.message,
        username: (msg as any).reply_to.profiles?.username || 'Inconnu'
      } : null

      return {
        id: msg.id,
        message: msg.message,
        created_at: msg.created_at,
        user_id: msg.user_id,
        username: (msg.profiles as any)?.username || 'Inconnu',
        avatar: (msg.profiles as any)?.avatar || 'avatar1',
        readers, // Liste des lecteurs pour ce message
        reply_to_id: (msg as any).reply_to_id || null,
        reply_to: replyTo,
        reactions
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

    // Tracker l'activité (fire-and-forget)
    updateLastSeen(supabase, user.id)

    // Récupérer le message depuis le body
    const body = await request.json()
    const { message, reply_to_id } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Le message ne peut pas être vide' }, { status: 400 })
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Le message est trop long (max 500 caractères)' }, { status: 400 })
    }

    // Vérifier le contenu du message (filtre anti-insultes)
    const profanityCheck = checkMessage(message)
    if (!profanityCheck.isClean) {
      console.log(`[PROFANITY BLOCKED] User ${user.id} tried to send: "${message.substring(0, 100)}..." - Detected: ${profanityCheck.detectedWords.join(', ')}`)
      return NextResponse.json({
        error: 'Votre message contient des termes inappropriés. Merci de reformuler.'
      }, { status: 400 })
    }

    // Insérer le message
    const insertData: any = {
      tournament_id: tournamentId,
      user_id: user.id,
      message: message.trim()
    }
    if (reply_to_id) {
      insertData.reply_to_id = reply_to_id
    }

    const { data: newMessage, error: insertError } = await supabase
      .from('tournament_messages')
      .insert(insertData)
      .select(`
        id,
        message,
        created_at,
        user_id,
        reply_to_id,
        profiles:user_id (
          username,
          avatar
        ),
        reply_to:reply_to_id (
          id,
          message,
          user_id,
          profiles:user_id (
            username
          )
        )
      `)
      .single()

    if (insertError) {
      console.error('Error inserting message:', insertError)
      return NextResponse.json({ error: 'Erreur lors de l\'envoi du message' }, { status: 500 })
    }

    // Formater le message
    const replyTo = (newMessage as any).reply_to ? {
      id: (newMessage as any).reply_to.id,
      message: (newMessage as any).reply_to.message,
      username: (newMessage as any).reply_to.profiles?.username || 'Inconnu'
    } : null

    const formattedMessage = {
      id: newMessage.id,
      message: newMessage.message,
      created_at: newMessage.created_at,
      user_id: newMessage.user_id,
      username: (newMessage.profiles as any)?.username || 'Inconnu',
      avatar: (newMessage.profiles as any)?.avatar || 'avatar1',
      reply_to_id: (newMessage as any).reply_to_id || null,
      reply_to: replyTo,
      reactions: [], // Nouveau message = pas encore de réactions
      readers: [] // Nouveau message = pas encore de lecteurs
    }

    // Détecter les mentions (@username) et envoyer des notifications
    // Regex qui capture les lettres, chiffres, underscore ET apostrophes
    const mentionRegex = /@([\w']+)/g
    const mentions = [...message.matchAll(mentionRegex)].map(match => match[1])

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

      // Pour chaque mention, envoyer une notification
      for (const mentionedUsername of mentions) {
        // Trouver l'utilisateur mentionné parmi les participants
        const mentionedUser = participants?.find(
          p => (p.profiles as any)?.username?.toLowerCase() === mentionedUsername.toLowerCase()
        )

        if (mentionedUser && mentionedUser.user_id !== user.id) {
          // Ne pas notifier l'auteur du message
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
          } catch (notifError) {
            console.error(`Erreur envoi notification mention pour ${mentionedUsername}:`, notifError)
            // Ne pas bloquer l'envoi du message si la notification échoue
          }
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

    // Tracker l'activité (fire-and-forget)
    updateLastSeen(supabase, user.id)

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
