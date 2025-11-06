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

async function checkCompetition() {
  // Vérifier les données de la compétition 2013
  const { data: comp, error: compError } = await supabase
    .from('competitions')
    .select('id, name, current_matchday, total_matchdays')
    .eq('id', 2013)
    .single()

  if (compError) {
    console.error('Error fetching competition:', compError)
    return
  }

  console.log('Competition data:')
  console.log('ID:', comp.id)
  console.log('Name:', comp.name)
  console.log('current_matchday:', comp.current_matchday)
  console.log('total_matchdays:', comp.total_matchdays)

  // Compter les journées disponibles dans imported_matches
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('matchday')
    .eq('competition_id', 2013)
    .gte('matchday', comp.current_matchday)
    .order('matchday')

  const uniqueMatchdays = matches
    ? [...new Set(matches.map(m => m.matchday))].sort((a, b) => a - b)
    : []

  console.log('\nAvailable matchdays from current:', uniqueMatchdays)
  console.log('Count of available matchdays:', uniqueMatchdays.length)

  // Calculer selon la formule actuelle
  const remainingMatchdays = comp.total_matchdays > 0
    ? Math.max(0, comp.total_matchdays - comp.current_matchday + 1)
    : 0

  console.log('\nCalculation:')
  console.log('Formula: total_matchdays - current_matchday + 1')
  console.log(`${comp.total_matchdays} - ${comp.current_matchday} + 1 = ${remainingMatchdays}`)
}

checkCompetition()
