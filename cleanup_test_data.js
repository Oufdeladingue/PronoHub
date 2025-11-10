const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Lire le fichier .env.local
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) {
    envVars[key.trim()] = values.join('=').trim()
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupTestData() {
  console.log('=== Nettoyage des données de test ===\n')

  // 1. Trouver le tournoi BrazilTest
  console.log('1. Recherche du tournoi BrazilTest...')
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%brazil%test%')
    .single()

  if (tournamentError || !tournament) {
    console.error('❌ Tournoi BrazilTest non trouvé')
    return
  }

  console.log(`✓ Tournoi trouvé: ${tournament.name}`)

  const testMatchday = tournament.starting_matchday
  console.log(`✓ Journée de test: J${testMatchday}`)

  // 2. Récupérer les matchs de cette journée
  console.log('\n2. Récupération des matchs de la journée...')
  const { data: matches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('id')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', testMatchday)

  if (matchesError || !matches || matches.length === 0) {
    console.error('❌ Aucun match trouvé')
    return
  }

  console.log(`✓ ${matches.length} matchs trouvés`)

  const matchIds = matches.map(m => m.id)

  // 3. Supprimer les pronostics
  console.log('\n3. Suppression des pronostics de test...')
  const { error: deletePredictionsError } = await supabase
    .from('predictions')
    .delete()
    .eq('tournament_id', tournament.id)
    .in('match_id', matchIds)

  if (deletePredictionsError) {
    console.error('❌ Erreur lors de la suppression des pronostics:', deletePredictionsError.message)
  } else {
    console.log('✓ Pronostics supprimés')
  }

  // 4. Réinitialiser les scores des matchs
  console.log('\n4. Réinitialisation des scores des matchs...')
  const { error: updateMatchesError } = await supabase
    .from('imported_matches')
    .update({
      home_score: null,
      away_score: null,
      finished: false,
      status: 'TIMED'
    })
    .in('id', matchIds)

  if (updateMatchesError) {
    console.error('❌ Erreur lors de la réinitialisation des matchs:', updateMatchesError.message)
  } else {
    console.log('✓ Scores des matchs réinitialisés')
  }

  console.log('\n' + '='.repeat(60))
  console.log('✓ NETTOYAGE TERMINÉ')
  console.log('='.repeat(60))
}

cleanupTestData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
