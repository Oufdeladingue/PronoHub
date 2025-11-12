require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugKingOfDay() {
  try {
    // Trouver joueur1
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('=== DEBUG KING OF DAY POUR', user.username.toUpperCase(), '===\n')

    // Récupérer le tournoi BrazilTest
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, starting_matchday, ending_matchday, competition_id')
      .ilike('name', '%BrazilTest%')
      .single()

    console.log('Tournoi:', tournament.name)
    console.log('Journées:', tournament.starting_matchday, '→', tournament.ending_matchday)
    console.log('Competition ID:', tournament.competition_id, '\n')

    // Vérifier la journée 32 spécifiquement
    const matchday = 32

    console.log(`=== ANALYSE DÉTAILLÉE JOURNÉE ${matchday} ===\n`)

    // 1. Récupérer les matchs de la journée
    const { data: journeyMatches } = await supabase
      .from('imported_matches')
      .select('id, status, finished, home_score, away_score, utc_date')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    console.log(`Matchs de la journée: ${journeyMatches?.length || 0}`)

    if (!journeyMatches || journeyMatches.length === 0) {
      console.log('⚠️ AUCUN MATCH TROUVÉ pour cette journée!')
      return
    }

    const finishedMatches = journeyMatches.filter(m =>
      (m.status === 'FINISHED' || m.finished === true) &&
      m.home_score !== null &&
      m.away_score !== null
    )

    console.log(`Matchs terminés: ${finishedMatches.length}`)
    console.log(`Matchs en attente: ${journeyMatches.length - finishedMatches.length}\n`)

    if (finishedMatches.length === 0) {
      console.log('⚠️ AUCUN MATCH TERMINÉ pour cette journée!')
      return
    }

    const allMatchesFinished = journeyMatches.every(m =>
      (m.status === 'FINISHED' || m.finished === true) &&
      m.home_score !== null &&
      m.away_score !== null
    )

    console.log(`Tous les matchs terminés? ${allMatchesFinished ? '✓ OUI' : '✗ NON'}`)

    if (!allMatchesFinished) {
      console.log('⚠️ La logique actuelle exige que TOUS les matchs soient terminés')
      console.log('   Le trophée ne peut donc PAS être débloqué pour cette journée\n')
    } else {
      console.log('✓ Condition remplie pour analyse du classement\n')
    }

    // 2. Récupérer tous les participants du tournoi
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id, profiles(username)')
      .eq('tournament_id', tournament.id)

    console.log(`Participants: ${participants?.length || 0}`)
    participants?.forEach(p => {
      console.log(`  - ${p.profiles.username}`)
    })
    console.log('')

    const userIds = participants.map(p => p.user_id)
    const matchIds = journeyMatches.map(m => m.id)

    console.log(`Match IDs (${matchIds.length}):`, matchIds.slice(0, 3).join(', '), '...\n')

    // 3. Récupérer les pronostics pour cette journée
    const { data: journeyPredictions, error: predError } = await supabase
      .from('predictions')
      .select('user_id, points_earned, match_id, profiles(username)')
      .eq('tournament_id', tournament.id)
      .in('user_id', userIds)
      .in('match_id', matchIds)

    if (predError) {
      console.error('Erreur récupération pronostics:', predError)
      return
    }

    console.log(`Pronostics trouvés: ${journeyPredictions?.length || 0}`)

    if (!journeyPredictions || journeyPredictions.length === 0) {
      console.log('⚠️ AUCUN PRONOSTIC TROUVÉ pour cette journée!')
      return
    }

    // Grouper par utilisateur
    const userPoints = {}
    journeyPredictions.forEach(pred => {
      if (!userPoints[pred.user_id]) {
        userPoints[pred.user_id] = {
          username: pred.profiles?.username || 'Unknown',
          points: 0,
          predictions: 0
        }
      }
      userPoints[pred.user_id].points += pred.points_earned || 0
      userPoints[pred.user_id].predictions++
    })

    console.log('\nClassement de la journée:')
    const sorted = Object.entries(userPoints)
      .sort((a, b) => b[1].points - a[1].points)

    sorted.forEach(([uid, data], idx) => {
      const isTarget = uid === user.id
      console.log(`  ${idx + 1}. ${data.username}: ${data.points} pts (${data.predictions} pronostics)${isTarget ? ' ← LUI' : ''}`)
    })

    const maxPoints = Math.max(...Object.values(userPoints).map(u => u.points))
    console.log(`\nPoints maximum: ${maxPoints}`)

    if (userPoints[user.id] && userPoints[user.id].points === maxPoints && maxPoints > 0) {
      console.log('\n✅ L\'UTILISATEUR DEVRAIT AVOIR LE TROPHÉE "KING OF DAY"!')

      // Compter combien ont le max
      const winners = sorted.filter(([uid, data]) => data.points === maxPoints)
      if (winners.length > 1) {
        console.log(`⚠️ Attention: ${winners.length} utilisateurs ex-aequo avec ${maxPoints} points`)
      }
    } else {
      console.log('\n✗ L\'utilisateur n\'a pas le score maximum pour cette journée')
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

debugKingOfDay()
