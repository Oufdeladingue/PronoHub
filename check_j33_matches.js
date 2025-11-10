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

async function checkJ33Matches() {
  console.log('=== Vérification des matchs J33 ===\n')

  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', 2013)
    .eq('matchday', 33)
    .order('utc_date', { ascending: true })

  if (error) {
    console.error('Erreur:', error.message)
    return
  }

  if (!matches || matches.length === 0) {
    console.log('❌ Aucun match trouvé pour la J33')
    return
  }

  console.log(`✓ ${matches.length} matchs trouvés pour la J33\n`)

  matches.forEach(match => {
    console.log(`${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`  Date: ${match.utc_date}`)
    console.log(`  Status: ${match.status}`)
    console.log(`  Finished: ${match.finished}`)
    console.log(`  Score: ${match.home_score} - ${match.away_score}`)
    console.log()
  })

  // Vérifier si ces dates sont dans le futur ou le passé
  const now = new Date()
  const futureMatches = matches.filter(m => new Date(m.utc_date) > now)
  const pastMatches = matches.filter(m => new Date(m.utc_date) <= now)

  console.log(`Matchs dans le futur: ${futureMatches.length}`)
  console.log(`Matchs dans le passé: ${pastMatches.length}`)
}

checkJ33Matches()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
