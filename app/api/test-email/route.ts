import { sendMatchdayRecapEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

// Route TEMPORAIRE pour tester l'email récap journée
// À SUPPRIMER après le test
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')

  if (!to) {
    return NextResponse.json({ error: 'Paramètre ?to=email@example.com requis' }, { status: 400 })
  }

  const result = await sendMatchdayRecapEmail(to, {
    username: 'Zizou34',
    tournamentName: 'Les Rois du Prono',
    tournamentSlug: 'les-rois-du-prono-abc123',
    competitionName: 'Ligue 1',
    matchdayNumber: 24,
    userPointsGained: 11,
    matchdayRanking: [
      { rank: 1, username: 'Zizou34', points: 11, isCurrentUser: true },
      { rank: 2, username: 'Sandrinette', points: 9, isCurrentUser: false },
      { rank: 3, username: 'Théo_File', points: 8, isCurrentUser: false },
      { rank: 4, username: 'LePetitPrince', points: 6, isCurrentUser: false },
      { rank: 5, username: 'MbappéFan', points: 5, isCurrentUser: false },
    ],
    generalRanking: [
      { rank: 1, username: 'Sandrinette', totalPoints: 187, isCurrentUser: false },
      { rank: 2, username: 'Zizou34', totalPoints: 182, isCurrentUser: true },
      { rank: 3, username: 'Théo_File', totalPoints: 175, isCurrentUser: false },
      { rank: 4, username: 'LePetitPrince', totalPoints: 160, isCurrentUser: false },
      { rank: 5, username: 'MbappéFan', totalPoints: 148, isCurrentUser: false },
    ],
    userStats: {
      exactScores: 2,
      correctResults: 3,
      matchdayRank: 1,
      generalRank: 2,
      rankChange: +1,
    },
    newTrophies: [
      { name: 'Roi de la Journée', description: 'Premier du classement de la journée' },
    ],
    bestMatch: {
      homeTeam: 'PSG',
      awayTeam: 'OM',
      homeCrest: 'https://crests.football-data.org/524.png',
      awayCrest: 'https://crests.football-data.org/516.png',
      homeScore: 2,
      awayScore: 1,
      userPredictionHome: 2,
      userPredictionAway: 1,
      points: 3,
    },
    worstMatch: {
      homeTeam: 'Lyon',
      awayTeam: 'Monaco',
      homeCrest: 'https://crests.football-data.org/523.png',
      awayCrest: 'https://crests.football-data.org/548.png',
      homeScore: 0,
      awayScore: 3,
      userPredictionHome: 2,
      userPredictionAway: 0,
      points: 0,
    },
  })

  return NextResponse.json({
    sent: result.success,
    to,
    messageId: result.messageId,
    error: result.error,
  })
}
