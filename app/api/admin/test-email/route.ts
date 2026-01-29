import { NextResponse } from 'next/server'
import { sendTournamentStartedEmail } from '@/lib/email'

/**
 * API admin pour tester l'envoi d'email de lancement de tournoi
 * POST /api/admin/test-email
 * Body: { email: string, type?: string }
 *
 * Protégé par CRON_SECRET
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { email, type = 'tournament_started', isCustomCompetition = false } = body

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 })
    }

    if (type === 'tournament_started') {
      const result = await sendTournamentStartedEmail(email, {
        username: 'Rom\'s',
        tournamentName: isCustomCompetition ? 'Best of Week #12' : 'Ligue des Champions 2024/25',
        tournamentSlug: isCustomCompetition ? 'best-of-week-12' : 'ligue-des-champions-2024',
        competitionName: isCustomCompetition ? 'Best of Week' : 'UEFA Champions League',
        isCustomCompetition,
        participants: [
          { username: 'Rom\'s', isCaptain: true },
          { username: 'Alex', isCaptain: false },
          { username: 'Marie', isCaptain: false },
          { username: 'Thomas', isCaptain: false },
          { username: 'Sophie', isCaptain: false },
        ],
        matchdayRange: {
          start: 7,
          end: 8,
          totalMatches: 36
        },
        firstMatchDate: 'Mardi 4 février à 21h00',
        firstMatchDeadline: '20h30',
        rules: {
          exactScore: 3,
          correctResult: 1,
          correctGoalDiff: 2,
          bonusMatchEnabled: true,
          earlyPredictionBonus: true,
          defaultPredictionMaxPoints: 1
        },
        userActiveTournaments: 2
      })

      return NextResponse.json({
        success: result.success,
        message: result.success ? `Email envoyé à ${email}` : 'Échec de l\'envoi',
        messageId: result.messageId,
        error: result.error
      })
    }

    return NextResponse.json({ error: 'Type non supporté' }, { status: 400 })
  } catch (error: any) {
    console.error('[API Admin Test Email] Erreur:', error)
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error.message
    }, { status: 500 })
  }
}
