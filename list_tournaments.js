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

async function listTournaments() {
  const { data, error } = await supabase
    .from('tournaments')
    .select('name, slug')
    .limit(10)

  if (error) {
    console.error('Erreur:', error)
    return
  }

  console.log('Tournois disponibles:')
  console.log('---------------------')
  data.forEach(t => {
    console.log(`- ${t.name} (slug: ${t.slug})`)
  })
}

listTournaments()
