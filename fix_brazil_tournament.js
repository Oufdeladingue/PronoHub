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

async function fixTournament() {
  const tournamentId = '0956fa4f-d661-436b-84f7-520015ffcf89'

  // Définir manuellement les journées
  const startingMatchday = 33
  const endingMatchday = 38
  const numMatchdays = endingMatchday - startingMatchday + 1

  console.log('\nValeurs à mettre à jour:')
  console.log('starting_matchday:', startingMatchday)
  console.log('ending_matchday:', endingMatchday)
  console.log('actual_matchdays:', numMatchdays)

  // Générer le snapshot des journées
  const matchdaySnapshot = Array.from(
    { length: numMatchdays },
    (_, i) => startingMatchday + i
  )

  console.log('matchday_snapshot:', matchdaySnapshot)

  // Mettre à jour le tournoi
  const { error } = await supabase
    .from('tournaments')
    .update({
      starting_matchday: startingMatchday,
      ending_matchday: endingMatchday,
      actual_matchdays: numMatchdays,
      matchday_snapshot: matchdaySnapshot
    })
    .eq('id', tournamentId)

  if (error) {
    console.error('Error updating tournament:', error)
    return
  }

  console.log('\n✅ Tournoi mis à jour avec succès!')

  // Vérifier la mise à jour
  const { data: updated } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  console.log('\nNouvelles valeurs:')
  console.log('starting_matchday:', updated.starting_matchday)
  console.log('ending_matchday:', updated.ending_matchday)
  console.log('actual_matchdays:', updated.actual_matchdays)
  console.log('matchday_snapshot:', updated.matchday_snapshot)
}

fixTournament()
