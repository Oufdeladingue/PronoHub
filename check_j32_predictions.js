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

async function checkJ32Predictions() {
  console.log('=== Vérification des pronostics J32 ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  console.log(`Tournoi: ${tournament.name} (${tournament.id})\n`)

  // 2. Récupérer les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  console.log('Participants:')
  participants.forEach(p => {
    console.log(`  - ${p.profiles?.username} (${p.user_id})`)
  })
  console.log()

  // 3. Récupérer tous les matchs de la J32
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('id, home_team_name, away_team_name, home_score, away_score, finished')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 32)
    .order('utc_date', { ascending: true })

  console.log(`Matchs J32: ${matches.length} matchs\n`)

  // 4. Pour chaque match, vérifier les pronostics
  for (const match of matches) {
    console.log(`\n${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`  Match ID: ${match.id}`)
    console.log(`  Score: ${match.home_score}-${match.away_score} ${match.finished ? '(Terminé)' : '(En cours)'}`)

    const { data: predictions } = await supabase
      .from('predictions')
      .select('user_id, predicted_home_score, predicted_away_score, profiles(username)')
      .eq('tournament_id', tournament.id)
      .eq('match_id', match.id)

    console.log(`  Pronostics: ${predictions?.length || 0}`)
    if (predictions && predictions.length > 0) {
      predictions.forEach(pred => {
        const username = pred.profiles?.username || 'Inconnu'
        console.log(`    - ${username}: ${pred.predicted_home_score}-${pred.predicted_away_score}`)
      })
    }
  }
}

checkJ32Predictions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
