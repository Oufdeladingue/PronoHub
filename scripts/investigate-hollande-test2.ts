import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function investigate() {
  console.log('=== Investigation détaillée HollandeTest ===\n')

  // 1. Trouver le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%hollande%')
    .single()

  if (!tournament) {
    console.log('Tournoi non trouvé')
    return
  }

  console.log('Tournament ID:', tournament.id)
  console.log('Competition ID:', tournament.competition_id)

  // 2. Récupérer les matchs terminés de la journée 13
  const { data: finishedMatches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 13)
    .not('home_score', 'is', null)

  console.log('\n=== Matchs J13 terminés ===')
  finishedMatches?.forEach(m => {
    console.log(`  ID: ${m.id} - ${m.home_team_name} ${m.home_score}-${m.away_score} ${m.away_team_name}`)
  })

  // 3. Récupérer les pronostics de Rom's
  const { data: romsProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', "Rom's")
    .single()

  if (!romsProfile) {
    console.log("Rom's non trouvé")
    return
  }

  console.log("\n=== Pronostics de Rom's ===")
  const { data: romsPredictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('user_id', romsProfile.id)

  romsPredictions?.forEach(p => {
    console.log(`  Match ID: ${p.match_id} - Prévu: ${p.predicted_home_score}-${p.predicted_away_score} (défaut: ${p.is_default_prediction})`)
  })

  // 4. Vérifier si les match_id correspondent
  const predMatchIds = romsPredictions?.map(p => p.match_id) || []
  const finishedMatchIds = finishedMatches?.map(m => m.id) || []

  console.log('\n=== Correspondance des IDs ===')
  console.log('IDs des pronostics:', predMatchIds)
  console.log('IDs des matchs terminés:', finishedMatchIds)

  const matching = predMatchIds.filter(id => finishedMatchIds.includes(id))
  console.log('IDs qui correspondent:', matching)

  // 5. Appeler l'API de classement pour voir ce qu'elle retourne
  console.log('\n=== Vérification via API rankings ===')

  // Calculer manuellement les points
  console.log('\n=== Calcul manuel des points ===')

  for (const pred of romsPredictions || []) {
    const match = finishedMatches?.find(m => m.id === pred.match_id)
    if (match) {
      const isExact = pred.predicted_home_score === match.home_score &&
                     pred.predicted_away_score === match.away_score
      const predOutcome = pred.predicted_home_score > pred.predicted_away_score ? 'H' :
                        (pred.predicted_home_score < pred.predicted_away_score ? 'A' : 'D')
      const realOutcome = match.home_score > match.away_score ? 'H' :
                        (match.home_score < match.away_score ? 'A' : 'D')
      const isCorrect = predOutcome === realOutcome

      let points = 0
      if (pred.is_default_prediction && realOutcome === 'D') {
        points = 1
      } else if (pred.is_default_prediction) {
        points = 0
      } else if (isExact) {
        points = 3
      } else if (isCorrect) {
        points = 1
      }

      console.log(`  Match ${match.home_team_name} vs ${match.away_team_name}:`)
      console.log(`    Prévu: ${pred.predicted_home_score}-${pred.predicted_away_score}, Réel: ${match.home_score}-${match.away_score}`)
      console.log(`    Exact: ${isExact}, Bon résultat: ${isCorrect}, Points: ${points}`)
    } else {
      console.log(`  Match ID ${pred.match_id}: PAS DANS LES MATCHS TERMINÉS`)
    }
  }
}

investigate().catch(console.error)
