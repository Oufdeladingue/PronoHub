import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définis dans .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPredictionsCount() {
  console.log('🔍 Vérification du nombre de pronostics...\n')

  // 1. Compter tous les pronostics
  const { count: totalPredictions, error: countError } = await supabase
    .from('predictions')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    console.error('❌ Erreur lors du comptage des pronostics:', countError)
    return
  }

  console.log(`📊 Total de pronostics dans la base: ${totalPredictions}`)

  // 2. Récupérer quelques exemples
  const { data: samplePredictions, error: sampleError } = await supabase
    .from('predictions')
    .select('id, user_id, match_id, tournament_id, predicted_home_score, predicted_away_score, created_at')
    .limit(10)

  if (sampleError) {
    console.error('❌ Erreur lors de la récupération des exemples:', sampleError)
    return
  }

  console.log(`\n📋 Exemples de pronostics (${samplePredictions?.length || 0} résultats):`)
  samplePredictions?.forEach((pred, index) => {
    console.log(`  ${index + 1}. ${pred.predicted_home_score}-${pred.predicted_away_score} (Match: ${pred.match_id.substring(0, 8)}...)`)
  })

  // 3. Compter par tournoi
  const { data: byTournament, error: tournamentError } = await supabase
    .from('predictions')
    .select('tournament_id')

  if (tournamentError) {
    console.error('❌ Erreur lors du comptage par tournoi:', tournamentError)
    return
  }

  const tournamentCounts = byTournament?.reduce((acc: any, pred) => {
    acc[pred.tournament_id] = (acc[pred.tournament_id] || 0) + 1
    return acc
  }, {})

  console.log(`\n🏆 Répartition par tournoi:`)
  Object.entries(tournamentCounts || {}).forEach(([tournamentId, count]) => {
    console.log(`  - Tournoi ${tournamentId.substring(0, 8)}...: ${count} pronostics`)
  })
}

checkPredictionsCount()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
