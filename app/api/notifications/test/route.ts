import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/firebase-admin'

/**
 * API pour tester l'envoi d'une notification push à l'utilisateur connecté
 * POST /api/notifications/test
 * Body: {
 *   type?: 'test' | 'reminder' | 'tournament_started' | 'day_recap' | 'tournament_end' | 'invite' | 'player_joined',
 *   realData?: boolean  // Pour reminder: utilise les vrais matchs manquants
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier que l'utilisateur est authentifié
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Récupérer le token FCM de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token, username')
      .eq('id', user.id)
      .single()

    if (!profile?.fcm_token) {
      return NextResponse.json({
        success: false,
        error: 'Aucun token FCM enregistré pour cet utilisateur',
        hint: 'Assurez-vous d\'avoir accepté les notifications dans l\'app'
      }, { status: 400 })
    }

    // Récupérer le type de notification à tester
    const body = await request.json().catch(() => ({}))
    const type = body.type || 'test'
    const realData = body.realData === true
    const username = profile.username || 'champion'

    // Si realData et type=reminder, récupérer les vrais matchs manquants
    let realReminderNotif: { title: string; body: string; data: Record<string, string> } | null = null

    if (realData && type === 'reminder') {
      const now = new Date()
      const endOfDay = new Date(now)
      endOfDay.setHours(23, 59, 59, 999)

      // Récupérer les tournois ACTIFS où l'utilisateur participe
      const { data: participations } = await supabase
        .from('tournament_participants')
        .select('tournament_id, tournaments!inner(id, name, slug, competition_id, starting_matchday, ending_matchday, status)')
        .eq('user_id', user.id)
        .eq('tournaments.status', 'active')

      if (participations && participations.length > 0) {
        // Récupérer les matchs du jour
        const { data: todayMatches } = await supabase
          .from('imported_matches')
          .select('id, competition_id, matchday, home_team_name, away_team_name, utc_date')
          .gte('utc_date', now.toISOString())
          .lte('utc_date', endOfDay.toISOString())
          .in('status', ['SCHEDULED', 'TIMED'])

        if (todayMatches && todayMatches.length > 0) {
          // Pour chaque tournoi, vérifier les matchs manquants
          for (const p of participations) {
            const tournament = p.tournaments as any
            if (!tournament) continue

            const tournamentMatches = todayMatches.filter(m =>
              m.competition_id === tournament.competition_id &&
              m.matchday >= (tournament.starting_matchday || 1) &&
              m.matchday <= (tournament.ending_matchday || 999)
            )

            if (tournamentMatches.length === 0) continue

            // Vérifier les pronostics existants
            const { data: predictions } = await supabase
              .from('predictions')
              .select('match_id')
              .eq('tournament_id', tournament.id)
              .eq('user_id', user.id)
              .in('match_id', tournamentMatches.map(m => m.id))

            const predictedMatchIds = new Set(predictions?.map(p => p.match_id) || [])
            const missingMatches = tournamentMatches.filter(m => !predictedMatchIds.has(m.id))

            if (missingMatches.length > 0) {
              const firstMatch = missingMatches[0]
              const matchDate = new Date(firstMatch.utc_date)
              const deadline = new Date(matchDate.getTime() - 30 * 60 * 1000)
              const deadlineStr = deadline.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              const tournamentSlug = `${tournament.name.toLowerCase().replace(/\\s+/g, '-')}_${tournament.slug}`

              realReminderNotif = {
                title: 'Pronostics en attente ⚽',
                body: `Tu n'as pas encore pronostiqué pour ${tournament.name}. ${missingMatches.length} match${missingMatches.length > 1 ? 's' : ''} à pronostiquer avant ${deadlineStr} !`,
                data: {
                  type: 'reminder',
                  tournamentSlug,
                  tournamentName: tournament.name,
                  missingCount: String(missingMatches.length),
                  firstMatch: `${firstMatch.home_team_name} - ${firstMatch.away_team_name}`
                }
              }
              break // Prendre le premier tournoi avec des matchs manquants
            }
          }
        }
      }

      if (!realReminderNotif) {
        return NextResponse.json({
          success: false,
          error: 'Aucun match manquant trouvé pour aujourd\'hui',
          hint: 'Tu as déjà pronostiqué tous tes matchs du jour !'
        })
      }
    }

    // Configurer le message selon le type
    const notifications: Record<string, { title: string; body: string; data?: Record<string, string> }> = {
      test: {
        title: 'Test PronoHub',
        body: `Bravo ${username} ! Les notifications fonctionnent.`,
        data: { type: 'test' }
      },
      reminder: realReminderNotif || {
        title: 'Pronostics en attente ⚽',
        body: 'Tu n\'as pas encore pronostiqué pour Ligue des Champions. 1 match à pronostiquer avant 20h00 !',
        data: {
          type: 'reminder',
          tournamentSlug: 'ligue-des-champions-2024',
          missingCount: '1'
        }
      },
      tournament_started: {
        title: 'Tournoi lancé ! 🚀',
        body: 'Le tournoi "Ligue des Champions 2024/25" vient de commencer. C\'est parti !',
        data: {
          type: 'tournament_started',
          tournamentSlug: 'ligue-des-champions-2024'
        }
      },
      day_recap: {
        title: 'Récap de la journée 📊',
        body: 'Journée 6 terminée ! Tu as marqué 18 points. Découvre ton classement.',
        data: {
          type: 'day_recap',
          tournamentSlug: 'ligue-des-champions-2024',
          points: '18',
          matchday: '6'
        }
      },
      tournament_end: {
        title: 'Tournoi terminé ! 🏆',
        body: 'Le tournoi "Ligue des Champions 2024/25" est terminé. Découvre le classement final !',
        data: {
          type: 'tournament_end',
          tournamentSlug: 'ligue-des-champions-2024'
        }
      },
      invite: {
        title: 'Invitation à un tournoi 🎯',
        body: 'Alex t\'invite à rejoindre le tournoi "Ligue 1 - Saison 2024/25"',
        data: {
          type: 'invite',
          inviteCode: 'PRONO2024'
        }
      },
      player_joined: {
        title: 'Lucas a rejoint Euro 2024 👋',
        body: 'Un nouveau joueur vient de rejoindre ton tournoi !',
        data: {
          type: 'player_joined',
          tournamentSlug: 'euro-2024',
          playerName: 'Lucas'
        }
      }
    }

    const notif = notifications[type] || notifications.test

    // Envoyer la notification de test
    try {
      const success = await sendPushNotification(
        profile.fcm_token,
        notif.title,
        notif.body,
        { ...notif.data, timestamp: new Date().toISOString() }
      )

      const typeLabels: Record<string, string> = {
        test: 'test général',
        reminder: 'rappel de pronostics',
        tournament_started: 'lancement de tournoi',
        day_recap: 'récap de journée',
        tournament_end: 'fin de tournoi',
        invite: 'invitation',
        player_joined: 'nouveau joueur'
      }

      return NextResponse.json({
        success: true,
        message: `Notification "${typeLabels[type] || type}" envoyée`,
        token: profile.fcm_token.substring(0, 20) + '...'
      })
    } catch (fcmError: any) {
      return NextResponse.json({
        success: false,
        error: 'Échec de l\'envoi de la notification',
        fcmError: {
          code: fcmError.code || 'unknown',
          message: fcmError.message || String(fcmError)
        },
        token: profile.fcm_token.substring(0, 30) + '...',
        hint: fcmError.code === 'messaging/invalid-registration-token'
          ? 'Le token FCM est invalide. Reconnectez-vous sur l\'app Android pour générer un nouveau token.'
          : 'Erreur Firebase Cloud Messaging'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[API Notifications Test] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * GET pour vérifier le statut du token FCM
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('fcm_token, notification_preferences')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      hasToken: !!profile?.fcm_token,
      tokenPreview: profile?.fcm_token ? profile.fcm_token.substring(0, 30) + '...' : null,
      preferences: profile?.notification_preferences || null
    })
  } catch (error) {
    console.error('[API Notifications Test] Erreur:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
