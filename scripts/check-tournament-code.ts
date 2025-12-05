import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTournaments() {
  console.log('Recherche des tournois récents...\n')

  // Chercher tous les tournois récents
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, status, custom_competition_id, competition_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Erreur:', error.message)
    return
  }

  console.log('Tournois récents:')
  tournaments?.forEach(t => {
    console.log(`  - ${t.name}`)
    console.log(`    slug: ${t.slug}`)
    console.log(`    invite_code: ${t.invite_code}`)
    console.log(`    status: ${t.status}`)
    console.log(`    competition_id: ${t.competition_id}`)
    console.log(`    custom_competition_id: ${t.custom_competition_id}`)
    console.log('')
  })

  // Chercher spécifiquement le code WOPXQQWJ
  console.log('\n--- Recherche spécifique WOPXQQWJ ---')
  const { data: specific, error: err2 } = await supabase
    .from('tournaments')
    .select('*')
    .or('invite_code.eq.WOPXQQWJ,slug.eq.WOPXQQWJ')

  console.log('Résultats:', specific?.length || 0)
  if (specific?.length) {
    console.log('Tournoi trouvé:', specific[0].name)
  }
  if (err2) console.log('Erreur:', err2.message)
}

checkTournaments()
