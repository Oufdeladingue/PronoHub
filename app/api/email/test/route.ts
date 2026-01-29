import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  sendDetailedReminderEmail,
  sendMultiTournamentReminderEmail,
  sendTournamentStartedEmail,
  sendMatchdayRecapEmail,
  sendTournamentEndEmail,
  sendTournamentInviteDetailedEmail,
  sendNewPlayerJoinedEmail
} from '@/lib/email'

// API de test pour prévisualiser et envoyer des emails
// Usage: POST /api/email/test avec { type: 'reminder' | 'tournament_started' | 'matchday_recap' | 'tournament_end' | 'invite' | 'new_player' }
// L'email est envoyé à l'adresse de l'utilisateur connecté

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const { type } = body
    const username = profile?.username || 'Joueur'

    // L'email est toujours envoyé à l'adresse de l'utilisateur connecté
    const email = user.email
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Aucune adresse email associée à ce compte' },
        { status: 400 }
      )
    }

    let result

    switch (type) {
      case 'reminder':
        result = await sendDetailedReminderEmail(email, {
          username,
          tournamentName: 'Ligue des Champions 2024/25',
          tournamentSlug: 'ligue-des-champions-2024',
          competitionName: 'UEFA Champions League',
          matchdayName: 'Journée 6 - Phase de ligue',
          matches: [
            {
              homeTeam: 'Paris Saint-Germain',
              awayTeam: 'Manchester City',
              matchDate: 'Mercredi 11 décembre à 21h00',
              deadlineTime: '20h00'
            },
            {
              homeTeam: 'FC Barcelona',
              awayTeam: 'Borussia Dortmund',
              matchDate: 'Mercredi 11 décembre à 21h00',
              deadlineTime: '20h00'
            },
            {
              homeTeam: 'Bayern Munich',
              awayTeam: 'Slovan Bratislava',
              matchDate: 'Mercredi 11 décembre à 18h45',
              deadlineTime: '17h45'
            }
          ],
          defaultPredictionMaxPoints: 1
        })
        break

      case 'reminder_multi':
        // Test du nouveau template multi-tournois
        result = await sendMultiTournamentReminderEmail(email, {
          username,
          tournaments: [
            {
              name: 'Ligue des Champions 2024/25',
              slug: 'ligue-des-champions-2024',
              competitionName: 'UEFA Champions League',
              matches: [
                {
                  homeTeam: 'Paris Saint-Germain',
                  awayTeam: 'Manchester City',
                  matchDate: 'Mercredi 11 décembre à 21h00',
                  deadlineTime: '20h00'
                },
                {
                  homeTeam: 'FC Barcelona',
                  awayTeam: 'Borussia Dortmund',
                  matchDate: 'Mercredi 11 décembre à 21h00',
                  deadlineTime: '20h00'
                }
              ]
            },
            {
              name: 'Ligue 1 - Entre Potes',
              slug: 'ligue-1-entre-potes',
              competitionName: 'Ligue 1 Uber Eats',
              matches: [
                {
                  homeTeam: 'Paris Saint-Germain',
                  awayTeam: 'Lyon',
                  matchDate: 'Dimanche 15 décembre à 20h45',
                  deadlineTime: '19h45'
                },
                {
                  homeTeam: 'Monaco',
                  awayTeam: 'Marseille',
                  matchDate: 'Dimanche 15 décembre à 20h45',
                  deadlineTime: '19h45'
                },
                {
                  homeTeam: 'Lille',
                  awayTeam: 'Nice',
                  matchDate: 'Dimanche 15 décembre à 17h00',
                  deadlineTime: '16h00'
                }
              ]
            }
          ],
          defaultPredictionMaxPoints: 1,
          earliestDeadline: '16h00'
        })
        break

      case 'tournament_started':
        result = await sendTournamentStartedEmail(email, {
          username,
          tournamentName: 'Ligue des Champions 2024/25',
          tournamentSlug: 'ligue-des-champions-2024',
          competitionName: 'UEFA Champions League',
          participants: [
            { username: 'Alex', isCaptain: true },
            { username, isCaptain: false },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
            { username: 'Sophie', isCaptain: false },
          ],
          matchdayRange: {
            start: 1,
            end: 8,
            totalMatches: 144
          },
          firstMatchDate: 'Mardi 17 septembre à 18h45',
          firstMatchDeadline: '18h15',
          rules: {
            exactScore: 3,
            correctResult: 1,
            correctGoalDiff: 2,
            bonusEnabled: true,
            bonusPoints: 5,
            defaultPredictionMaxPoints: 1
          },
          userActiveTournaments: 3
        })
        break

      case 'matchday_recap':
        result = await sendMatchdayRecapEmail(email, {
          username,
          tournamentName: 'Ligue des Champions 2024/25',
          tournamentSlug: 'ligue-des-champions-2024',
          competitionName: 'UEFA Champions League',
          matchdayNumber: 6,
          userPointsGained: 18,
          matchdayRanking: [
            { rank: 1, username: 'Marie', points: 24, isCurrentUser: false },
            { rank: 2, username, points: 18, isCurrentUser: true },
            { rank: 3, username: 'Thomas', points: 15, isCurrentUser: false },
            { rank: 4, username: 'Alex', points: 12, isCurrentUser: false },
            { rank: 5, username: 'Sophie', points: 9, isCurrentUser: false },
          ],
          generalRanking: [
            { rank: 1, username, totalPoints: 98, isCurrentUser: true },
            { rank: 2, username: 'Marie', totalPoints: 95, isCurrentUser: false },
            { rank: 3, username: 'Alex', totalPoints: 87, isCurrentUser: false },
            { rank: 4, username: 'Thomas', totalPoints: 82, isCurrentUser: false },
            { rank: 5, username: 'Sophie', totalPoints: 76, isCurrentUser: false },
          ],
          userStats: {
            exactScores: 3,
            correctResults: 5,
            matchdayRank: 2,
            generalRank: 1,
            rankChange: 2
          },
          newTrophies: [
            { name: 'Visionnaire', description: '3 scores exacts sur une journée' }
          ]
        })
        break

      case 'tournament_end':
        result = await sendTournamentEndEmail(email, {
          username,
          tournamentName: 'Ligue des Champions 2024/25',
          tournamentSlug: 'ligue-des-champions-2024',
          competitionName: 'UEFA Champions League',
          finalRanking: [
            { rank: 1, username, totalPoints: 156, isCurrentUser: true },
            { rank: 2, username: 'Marie', totalPoints: 148, isCurrentUser: false },
            { rank: 3, username: 'Alex', totalPoints: 142, isCurrentUser: false },
            { rank: 4, username: 'Thomas', totalPoints: 135, isCurrentUser: false },
            { rank: 5, username: 'Sophie', totalPoints: 128, isCurrentUser: false },
          ],
          userFinalStats: {
            finalRank: 1,
            totalPoints: 156,
            exactScores: 28,
            correctResults: 62,
            perfectMatchdays: 2
          },
          winner: {
            username,
            totalPoints: 156
          },
          newTrophies: [
            { name: 'Champion', description: 'Remporter un tournoi' },
            { name: 'Maître du Prono', description: 'Plus de 150 points sur un tournoi' }
          ]
        })
        break

      case 'invite':
        result = await sendTournamentInviteDetailedEmail(email, {
          inviterUsername: 'Alex',
          tournamentName: 'Ligue 1 - Saison 2024/25',
          tournamentSlug: 'ligue-1-2024',
          inviteCode: 'PRONO2024',
          competitionName: 'Ligue 1 Uber Eats',
          participants: [
            { username: 'Alex', isCaptain: true },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
          ],
          matchdayRange: {
            start: 15,
            end: 38,
            totalMatches: 230
          },
          rules: {
            exactScore: 3,
            correctResult: 1,
            correctGoalDiff: 2,
            bonusEnabled: true,
            bonusPoints: 5
          }
        })
        break

      case 'new_player':
        result = await sendNewPlayerJoinedEmail(email, {
          captainUsername: username,
          tournamentName: 'Euro 2024',
          tournamentSlug: 'euro-2024',
          competitionName: 'UEFA Euro 2024',
          newPlayerUsername: 'Lucas',
          currentParticipants: 8,
          maxParticipants: 8,
          participants: [
            { username, isCaptain: true },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
            { username: 'Sophie', isCaptain: false },
            { username: 'Alex', isCaptain: false },
            { username: 'Julie', isCaptain: false },
            { username: 'Pierre', isCaptain: false },
            { username: 'Lucas', isCaptain: false },
          ],
          canLaunchTournament: true
        })
        break

      default:
        return NextResponse.json(
          { success: false, error: `Type d'email non supporté: ${type}. Types disponibles: reminder, reminder_multi, tournament_started, matchday_recap, tournament_end, invite, new_player` },
          { status: 400 }
        )
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    const typeLabels: Record<string, string> = {
      reminder: 'rappel de pronostics',
      reminder_multi: 'rappel multi-tournois',
      tournament_started: 'lancement de tournoi',
      matchday_recap: 'récap de journée',
      tournament_end: 'récap fin de tournoi',
      invite: 'invitation détaillée',
      new_player: 'nouveau joueur'
    }

    return NextResponse.json({
      success: true,
      message: `Email de test "${typeLabels[type] || type}" envoyé à ${email}`,
      messageId: result.messageId
    })
  } catch (error: any) {
    console.error('Test email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
