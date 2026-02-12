import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import {
  getMatchdayChangesTemplate,
  getTournamentStartedTemplate,
  getTournamentEndTemplate,
  getTournamentInviteDetailedTemplate,
  getNewPlayerJoinedTemplate,
  getMentionTemplate
} from '@/lib/email/templates'

const TEST_EMAIL = 'kochroman6@gmail.com'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email') || TEST_EMAIL
    const type = request.nextUrl.searchParams.get('type') || 'new_matches'

    let html: string, text: string, subject: string

    switch (type) {
      case 'tournament_started': {
        const r = getTournamentStartedTemplate({
          username: 'TestUser',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          competitionName: 'UEFA Champions League',
          participants: [
            { username: 'Alex', isCaptain: true },
            { username: 'TestUser', isCaptain: false },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
            { username: 'Sophie', isCaptain: false },
          ],
          matchdayRange: { start: 1, end: 8, totalMatches: 144 },
          firstMatchDate: 'Mardi 17 septembre à 18h45',
          firstMatchDeadline: '18h15',
          rules: {
            exactScore: 3,
            correctResult: 1,
            correctGoalDiff: 2,
            bonusMatchEnabled: true,
            earlyPredictionBonus: true,
            defaultPredictionMaxPoints: 1
          },
          userActiveTournaments: 3
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }

      case 'tournament_end': {
        const r = getTournamentEndTemplate({
          username: 'TestUser',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          competitionName: 'UEFA Champions League',
          finalRanking: [
            { rank: 1, username: 'Marie', totalPoints: 156, isCurrentUser: false },
            { rank: 2, username: 'TestUser', totalPoints: 142, isCurrentUser: true },
            { rank: 3, username: 'Alex', totalPoints: 138, isCurrentUser: false },
            { rank: 4, username: 'Thomas', totalPoints: 121, isCurrentUser: false },
            { rank: 5, username: 'Sophie', totalPoints: 109, isCurrentUser: false },
          ],
          userFinalStats: {
            finalRank: 2,
            totalPoints: 142,
            exactScores: 12,
            correctResults: 45,
            perfectMatchdays: 3
          },
          winner: { username: 'Marie', totalPoints: 156 },
          newTrophies: [
            { name: 'Podium', description: 'Terminer dans le top 3 d\'un tournoi' },
            { name: 'Nostradamus', description: '10+ scores exacts dans un tournoi' }
          ]
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }

      case 'invite': {
        const r = getTournamentInviteDetailedTemplate({
          inviterUsername: 'Alex',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          inviteCode: 'ABC123',
          competitionName: 'UEFA Champions League',
          participants: [
            { username: 'Alex', isCaptain: true },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
          ],
          matchdayRange: { start: 1, end: 8, totalMatches: 144 },
          rules: {
            exactScore: 3,
            correctResult: 1,
            correctGoalDiff: 2,
            bonusEnabled: true,
            bonusPoints: 2
          }
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }

      case 'player_joined': {
        const r = getNewPlayerJoinedTemplate({
          captainUsername: 'Alex',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          competitionName: 'UEFA Champions League',
          newPlayerUsername: 'Sophie',
          currentParticipants: 4,
          maxParticipants: 10,
          participants: [
            { username: 'Alex', isCaptain: true },
            { username: 'Marie', isCaptain: false },
            { username: 'Thomas', isCaptain: false },
            { username: 'Sophie', isCaptain: false },
          ],
          canLaunchTournament: true
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }

      case 'mention': {
        const r = getMentionTemplate({
          username: 'TestUser',
          senderUsername: 'Alex',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          competitionName: 'UEFA Champions League',
          message: 'Hey @TestUser tu as vu le match de hier soir ? PSG a été incroyable ! Je pense que tu vas avoir du mal à battre mon prono cette semaine 😄'
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }

      default: {
        const r = getMatchdayChangesTemplate({
          username: 'TestUser',
          tournamentName: 'Ligue des Champions 2025',
          tournamentSlug: 'ligue-des-champions-2025',
          competitionName: 'Best of Week 12',
          matchdayNumber: 12,
          changes: [
            {
              type: 'add',
              homeTeam: 'Paris Saint-Germain',
              awayTeam: 'FC Barcelona',
              homeTeamCrest: 'https://crests.football-data.org/524.png',
              awayTeamCrest: 'https://crests.football-data.org/81.png',
              matchDate: 'Samedi 15 février à 21h00'
            },
            {
              type: 'add',
              homeTeam: 'Real Madrid',
              awayTeam: 'Manchester City',
              homeTeamCrest: 'https://crests.football-data.org/86.png',
              awayTeamCrest: 'https://crests.football-data.org/65.png',
              matchDate: 'Dimanche 16 février à 21h00'
            },
            {
              type: 'remove',
              homeTeam: 'Bayern Munich',
              awayTeam: 'Juventus',
              matchDate: 'Mardi 18 février à 21h00'
            }
          ],
          totalMatchesInMatchday: 8
        })
        html = r.html; text = r.text; subject = r.subject
        break
      }
    }

    const sendResult = await sendEmail(email, subject, html, text)

    return NextResponse.json({
      success: sendResult.success,
      message: sendResult.success
        ? `Email "${type}" envoyé à ${email}`
        : `Erreur lors de l'envoi`,
      subject,
      error: sendResult.error,
      messageId: sendResult.messageId
    })
  } catch (error: any) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
