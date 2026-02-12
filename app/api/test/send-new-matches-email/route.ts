import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { getMatchdayChangesTemplate } from '@/lib/email/templates'

const TEST_EMAIL = 'kochroman6@gmail.com'

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email') || TEST_EMAIL

    const { html, text, subject } = getMatchdayChangesTemplate({
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

    const result = await sendEmail(email, subject, html, text)

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Email "new_matches" envoyé à ${email}`
        : `Erreur lors de l'envoi`,
      subject,
      error: result.error,
      messageId: result.messageId
    })
  } catch (error: any) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
