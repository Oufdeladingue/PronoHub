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

async function debugRankings() {
  const tournamentId = '0956fa4f-d661-436b-84f7-520015ffcf89'

  console.log('=== Debug du classement ===\n')

  // 1. Récupérer le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  console.log('1. Tournoi:')
  console.log(`   - ID: ${tournament.id}`)
  console.log(`   - Competition ID: ${tournament.competition_id}`)
  console.log(`   - Journées: ${tournament.starting_matchday} à ${tournament.ending_matchday}\n`)

  // 2. Récupérer les matchs terminés
  const matchdaysToCalculate = Array.from(
    { length: tournament.ending_matchday - tournament.starting_matchday + 1 },
    (_, i) => tournament.starting_matchday + i
  )

  console.log(`2. Journées à calculer: ${matchdaysToCalculate.join(', ')}\n`)

  const { data: finishedMatches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .in('matchday', matchdaysToCalculate)
    .eq('finished', true)
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)

  console.log('3. Matchs terminés:')
  console.log(`   - Nombre: ${finishedMatches?.length || 0}`)
  if (finishedMatches && finishedMatches.length > 0) {
    console.log(`   - Exemple: ${finishedMatches[0].home_team_name} vs ${finishedMatches[0].away_team_name} (J${finishedMatches[0].matchday})`)
    console.log(`   - IDs: ${finishedMatches.slice(0, 3).map(m => m.id).join(', ')}...\n`)
  }

  if (matchesError) {
    console.error('   Erreur:', matchesError)
  }

  // 3. Récupérer les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournamentId)

  console.log('4. Participants:')
  participants.forEach(p => {
    console.log(`   - ${p.profiles?.username} (${p.user_id})`)
  })
  console.log()

  // 4. Pour chaque participant, récupérer ses pronostics
  console.log('5. Pronostics par participant:\n')

  for (const participant of participants) {
    const username = participant.profiles?.username
    console.log(`   ${username}:`)

    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', participant.user_id)
      .eq('tournament_id', tournamentId)
      .in('match_id', finishedMatches?.map(m => m.id) || [])

    console.log(`     - Pronostics trouvés: ${predictions?.length || 0}`)

    if (predError) {
      console.error(`     - Erreur:`, predError)
    }

    if (predictions && predictions.length > 0) {
      const validPredictions = predictions.filter(p =>
        p.predicted_home_score !== null && p.predicted_away_score !== null
      )
      console.log(`     - Pronostics valides: ${validPredictions.length}`)
      console.log(`     - Exemple: Match ${predictions[0].match_id}, Score: ${predictions[0].predicted_home_score}-${predictions[0].predicted_away_score}`)
    }
    console.log()
  }
}

debugRankings()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
