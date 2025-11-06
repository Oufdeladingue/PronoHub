const { createClient } = require('@supabase/supabase-js')

// Charger les variables d'environnement depuis .env.local
const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTournament() {
  // Chercher tous les tournois qui contiennent "brazil" dans le nom
  const { data: tournaments, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%brazil%')

  if (tournamentError) {
    console.error('Error fetching tournament:', tournamentError)
    return
  }

  if (!tournaments || tournaments.length === 0) {
    console.log('Aucun tournoi trouvé avec "brazil" dans le nom')
    return
  }

  console.log(`Trouvé ${tournaments.length} tournoi(s):\n`)

  tournaments.forEach(tournament => {
    console.log('Tournament data:')
    console.log('ID:', tournament.id)
    console.log('Name:', tournament.name)
    console.log('Slug:', tournament.slug)
    console.log('Status:', tournament.status)
    console.log('Competition ID:', tournament.competition_id)
    console.log('starting_matchday:', tournament.starting_matchday)
    console.log('ending_matchday:', tournament.ending_matchday)
    console.log('num_matchdays:', tournament.num_matchdays)
    console.log('actual_matchdays:', tournament.actual_matchdays)
    console.log('\n---\n')
  })
}

checkTournament()
