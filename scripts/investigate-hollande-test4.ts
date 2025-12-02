import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function investigate() {
  console.log('=== Vérification API Rankings ===\n')

  // Simuler ce que fait l'API rankings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%hollande%')
    .single()

  if (!tournament) {
    console.log('Tournoi non trouvé')
    return
  }

  console.log('Tournament:', tournament.name)
  console.log('Starting matchday:', tournament.starting_matchday)
  console.log('Ending matchday:', tournament.ending_matchday)

  const matchdaysToCalculate = Array.from(
    { length: tournament.ending_matchday - tournament.starting_matchday + 1 },
    (_, i) => tournament.starting_matchday + i
  )

  console.log('Matchdays à calculer:', matchdaysToCalculate)

  // Récupérer les matchs terminés
  const { data: finishedMatches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .in('matchday', matchdaysToCalculate)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)

  console.log('\nMatchs terminés:', finishedMatches?.length || 0)

  // Récupérer les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  console.log('Participants:', participants?.length || 0)

  // Pour chaque participant, simuler le calcul comme l'API
  for (const participant of participants || []) {
    const username = (participant.profiles as any)?.username

    // Récupérer les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*, is_default_prediction')
      .eq('user_id', participant.user_id)
      .eq('tournament_id', tournament.id)
      .in('match_id', finishedMatches?.map(m => m.id) || [])

    console.log(`\n${username}:`)
    console.log(`  Pronostics pour matchs terminés: ${predictions?.length || 0}`)

    // L'API crée des pronostics par défaut virtuels pour les matchs sans pronostic
    const predictionsMap = new Map(predictions?.map(p => [p.match_id, p]) || [])

    const allPredictions = (finishedMatches || []).map(match => {
      const existingPred = predictionsMap.get(match.id)
      if (existingPred) {
        return existingPred
      }
      // Créer un pronostic par défaut 0-0 virtuel
      return {
        match_id: match.id,
        predicted_home_score: 0,
        predicted_away_score: 0,
        is_default_prediction: true,
        user_id: participant.user_id,
        tournament_id: tournament.id
      }
    })

    console.log(`  Pronostics totaux (avec défauts virtuels): ${allPredictions.length}`)

    // Calculer les points
    let totalPoints = 0
    for (const prediction of allPredictions) {
      const match = finishedMatches?.find(m => m.id === prediction.match_id)
      if (!match) continue

      const isExact = prediction.predicted_home_score === match.home_score &&
                     prediction.predicted_away_score === match.away_score
      const predOutcome = prediction.predicted_home_score > prediction.predicted_away_score ? 'H' :
                        (prediction.predicted_home_score < prediction.predicted_away_score ? 'A' : 'D')
      const realOutcome = match.home_score > match.away_score ? 'H' :
                        (match.home_score < match.away_score ? 'A' : 'D')
      const isCorrect = predOutcome === realOutcome

      let points = 0
      const isDefault = prediction.is_default_prediction || false

      if (isDefault && realOutcome === 'D') {
        points = 1 // Match nul avec pronostic par défaut
      } else if (isDefault) {
        points = 0
      } else if (isExact) {
        points = 3
      } else if (isCorrect) {
        points = 1
      }

      if (points > 0) {
        console.log(`    ${match.home_team_name} vs ${match.away_team_name}: ${match.home_score}-${match.away_score} => +${points} pts ${isDefault ? '(défaut)' : ''}`)
      }

      totalPoints += points
    }

    console.log(`  TOTAL: ${totalPoints} points`)
  }
}

investigate().catch(console.error)
