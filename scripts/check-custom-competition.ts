import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCustomCompetition() {
  console.log('=== Vérification des compétitions custom ===\n')

  // 1. Lister les compétitions custom
  const { data: customCompetitions } = await supabase
    .from('custom_competitions')
    .select('*')

  console.log('Compétitions custom:', customCompetitions?.length || 0)
  customCompetitions?.forEach(cc => {
    console.log(`  - ${cc.name} (ID: ${cc.id}, code: ${cc.code})`)
  })

  // 2. Lister les journées de chaque compétition custom
  console.log('\n=== Journées par compétition ===')
  for (const cc of customCompetitions || []) {
    const { data: matchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('*')
      .eq('custom_competition_id', cc.id)
      .order('matchday_number')

    console.log(`\n${cc.name}: ${matchdays?.length || 0} journées`)
    matchdays?.forEach(md => {
      console.log(`  - Journée ${md.matchday_number} (ID: ${md.id}, status: ${md.status})`)
    })

    // 3. Compter les matchs par journée
    for (const md of matchdays || []) {
      const { data: matches, count } = await supabase
        .from('custom_competition_matches')
        .select('*, imported_matches!inner(home_team, away_team)', { count: 'exact' })
        .eq('custom_matchday_id', md.id)

      console.log(`    -> ${count || 0} matchs`)
      matches?.slice(0, 3).forEach(m => {
        console.log(`       - ${m.cached_home_team || '?'} vs ${m.cached_away_team || '?'}`)
      })
    }
  }

  // 4. Vérifier le tournoi TestCustomWeek
  console.log('\n=== Tournoi TestCustomWeek ===')
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('name', 'TestCustomWeek')
    .single()

  if (tournament) {
    console.log('Tournoi trouvé:')
    console.log('  - ID:', tournament.id)
    console.log('  - custom_competition_id:', tournament.custom_competition_id)
    console.log('  - competition_id:', tournament.competition_id)
    console.log('  - status:', tournament.status)
    console.log('  - starting_matchday:', tournament.starting_matchday)
    console.log('  - ending_matchday:', tournament.ending_matchday)
  } else {
    console.log('Tournoi non trouvé')
  }
}

checkCustomCompetition()
