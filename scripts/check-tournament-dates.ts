import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%hollande%')
    .single()

  if (!tournament) {
    console.log('Tournoi non trouvé')
    return
  }

  console.log('Tournoi HollandeTest:')
  console.log('  status:', tournament.status)
  console.log('  starting_matchday:', tournament.starting_matchday)
  console.log('  ending_matchday:', tournament.ending_matchday)
  console.log('  created_at:', tournament.created_at)

  // Voir tous les champs non null
  console.log('\nTous les champs non null:')
  Object.keys(tournament).forEach(key => {
    if (tournament[key] !== null && tournament[key] !== undefined) {
      console.log(`  ${key}: ${tournament[key]}`)
    }
  })

  // Vérifier les dates des matchs de la J13 vs J14
  const { data: j13Matches } = await supabase
    .from('imported_matches')
    .select('utc_date')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 13)
    .order('utc_date', { ascending: true })
    .limit(1)

  const { data: j14Matches } = await supabase
    .from('imported_matches')
    .select('utc_date')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 14)
    .order('utc_date', { ascending: true })
    .limit(1)

  console.log('\nDates des premières journées:')
  console.log('  J13 premier match:', j13Matches?.[0]?.utc_date)
  console.log('  J14 premier match:', j14Matches?.[0]?.utc_date)
  console.log('  Tournoi créé:', tournament.created_at)
}

check().catch(console.error)
