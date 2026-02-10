/**
 * Script pour envoyer un email de test de récap de journée
 * Usage: npx tsx scripts/send-test-matchday-recap.ts
 */

import { sendMatchdayRecapEmail } from '../lib/email/send'

const testEmail = 'kochroman6@gmail.com'

async function main() {
  console.log('📧 Envoi d\'un email de test de récap de journée...')
  console.log(`Destinataire: ${testEmail}\n`)

  const result = await sendMatchdayRecapEmail(testEmail, {
    username: 'Roman',
    tournamentName: 'Ligue 1 - Saison 2025/26',
    tournamentSlug: 'ligue-1-2025-26',
    competitionName: 'Ligue 1 Uber Eats',
    matchdayNumber: 21,
    userPointsGained: 15,
    matchdayRanking: [
      { rank: 1, username: 'Marie', points: 21, isCurrentUser: false },
      { rank: 2, username: 'Alex', points: 18, isCurrentUser: false },
      { rank: 3, username: 'Roman', points: 15, isCurrentUser: true },
      { rank: 4, username: 'Thomas', points: 12, isCurrentUser: false },
      { rank: 5, username: 'Sophie', points: 9, isCurrentUser: false },
      { rank: 6, username: 'Julie', points: 9, isCurrentUser: false },
      { rank: 7, username: 'Pierre', points: 6, isCurrentUser: false },
      { rank: 8, username: 'Lucas', points: 6, isCurrentUser: false },
      { rank: 9, username: 'Emma', points: 3, isCurrentUser: false },
      { rank: 10, username: 'Hugo', points: 3, isCurrentUser: false },
    ],
    generalRanking: [
      { rank: 1, username: 'Alex', totalPoints: 156, isCurrentUser: false },
      { rank: 2, username: 'Roman', totalPoints: 148, isCurrentUser: true },
      { rank: 3, username: 'Marie', totalPoints: 145, isCurrentUser: false },
      { rank: 4, username: 'Thomas', totalPoints: 138, isCurrentUser: false },
      { rank: 5, username: 'Sophie', totalPoints: 132, isCurrentUser: false },
      { rank: 6, username: 'Julie', totalPoints: 125, isCurrentUser: false },
      { rank: 7, username: 'Pierre', totalPoints: 118, isCurrentUser: false },
      { rank: 8, username: 'Lucas', totalPoints: 112, isCurrentUser: false },
      { rank: 9, username: 'Emma', totalPoints: 105, isCurrentUser: false },
      { rank: 10, username: 'Hugo', totalPoints: 98, isCurrentUser: false },
    ],
    userStats: {
      exactScores: 2,
      correctResults: 3,
      matchdayRank: 3,
      generalRank: 2,
      rankChange: 1
    },
    newTrophies: [
      { name: 'King of the Day', description: 'Meilleur score de la journée' }
    ]
  })

  if (result.success) {
    console.log('✅ Email envoyé avec succès !')
    console.log(`Message ID: ${result.messageId}`)
    console.log(`\nVérifie ta boîte mail: ${testEmail}`)
    console.log(`(N'oublie pas de vérifier les spams si tu ne le vois pas)`)
  } else {
    console.error('❌ Erreur lors de l\'envoi:')
    console.error(result.error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('❌ Erreur:', error)
  process.exit(1)
})
