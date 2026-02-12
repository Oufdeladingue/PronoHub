import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { getMatchdayChangesTemplate, getTournamentStartedTemplate } from '@/lib/email/templates'

const TEST_EMAIL = 'kochroman6@gmail.com'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email') || TEST_EMAIL
    const type = request.nextUrl.searchParams.get('type') || 'new_matches'

    let html: string, text: string, subject: string

    switch (type) {
      case 'tournament_started': {
        const result = getTournamentStartedTemplate({
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
        html = result.html
        text = result.text
        subject = result.subject
        break
      }

      default: {
        const result = getMatchdayChangesTemplate({
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
        html = result.html
        text = result.text
        subject = result.subject
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
