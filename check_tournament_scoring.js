const { createClient } = require('@supabase/supabase-js')

// Lire directement depuis le fichier .env.local
const fs = require('fs')
const envContent = fs.readFileSync('.env.local', 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1]] = match[2]
  }
})

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkTournamentScoring() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('name, slug, scoring_draw_with_default_prediction, scoring_exact_with_default_prediction, scoring_draw, scoring_exact, scoring_loss')
    .eq('slug', 'braziltest')
    .single()

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log('Tournoi BrazilTest:')
  console.log('-------------------')
  console.log('Nom:', data.name)
  console.log('Slug:', data.slug)
  console.log('\nPoints normaux:')
  console.log('- Score exact:', data.scoring_exact)
  console.log('- Bon résultat:', data.scoring_draw)
  console.log('- Mauvais résultat:', data.scoring_loss)
  console.log('\nPoints avec prono par défaut (0-0):')
  console.log('- Score exact avec défaut:', data.scoring_exact_with_default_prediction)
  console.log('- Bon résultat avec défaut:', data.scoring_draw_with_default_prediction)
}

checkTournamentScoring()
