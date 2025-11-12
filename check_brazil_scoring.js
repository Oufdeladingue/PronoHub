const { createClient } = require('@supabase/supabase-js')
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

async function checkTournament() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('slug', 'UBPBZYHL')
    .single()

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log('Tournoi BrazilTest:')
  console.log('-------------------')
  console.log('Nom:', data.name)
  console.log('Slug:', data.slug)
  console.log('\nColonnes de scoring trouvées:')
  Object.keys(data).sort().forEach(key => {
    if (key.includes('scoring') || key.includes('default')) {
      console.log(`  ${key}:`, data[key])
    }
  })
}

checkTournament()
