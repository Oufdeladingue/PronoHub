/**
 * Script pour trouver TOUS les pronostics de Roms
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function findRomsPredictions() {
  console.log('\n🔍 Recherche de TOUS les pronostics de Roms...\n')

  // 1. Trouver Rom's
  const { data: roms } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%rom%')

  if (!roms || roms.length === 0) {
    console.error('❌ Utilisateur Roms non trouvé')
    return
  }

  console.log(`✅ Utilisateur(s) trouvé(s):`)
  roms.forEach(r => console.log(`   - ${r.username} (${r.id})`))
  console.log('')

  const romsId = roms[0].id

  // 2. Trouver TOUS les pronostics de Roms
  const { data: allPredictions, count } = await supabase
    .from('predictions')
    .select('*, tournaments!inner(name, slug), imported_matches!inner(matchday, home_team_name, away_team_name, status)', { count: 'exact' })
    .eq('user_id', romsId)
    .order('created_at', { ascending: false })

  console.log(`📊 Total pronostics trouvés: ${count || 0}`)
  console.log('')

  if (!allPredictions || allPredictions.length === 0) {
    console.log('❌ Aucun pronostic trouvé pour Roms')
    return
  }

  // 3. Grouper par tournoi
  const byTournament = allPredictions.reduce((acc: any, pred: any) => {
    const tournamentName = pred.tournaments.name
    if (!acc[tournamentName]) {
      acc[tournamentName] = []
    }
    acc[tournamentName].push(pred)
    return acc
  }, {})

  console.log('📋 PRONOSTICS PAR TOURNOI:')
  console.log('══════════════════════════════════════════════════════════════')

  for (const [tournamentName, preds] of Object.entries(byTournament)) {
    const predictions = preds as any[]
    console.log(`\n🏆 ${tournamentName}`)
    console.log(`   ${predictions.length} pronostics`)

    // Grouper par journée
    const byMatchday = predictions.reduce((acc: any, pred: any) => {
      const matchday = pred.imported_matches.matchday
      if (!acc[matchday]) acc[matchday] = []
      acc[matchday].push(pred)
      return acc
    }, {})

    const matchdays = Object.keys(byMatchday).sort((a, b) => parseInt(a) - parseInt(b))

    for (const matchday of matchdays) {
      const mdPreds = byMatchday[matchday]
      const defaultCount = mdPreds.filter((p: any) => p.is_default_prediction).length
      console.log(`   📅 J${matchday}: ${mdPreds.length} pronostics (${defaultCount} par défaut)`)

      // Afficher quelques exemples
      if (mdPreds.length > 0 && mdPreds.length <= 3) {
        mdPreds.forEach((p: any) => {
          const def = p.is_default_prediction ? ' (DÉFAUT)' : ''
          console.log(`      - ${p.imported_matches.home_team_name} vs ${p.imported_matches.away_team_name}: ${p.predicted_home_score}-${p.predicted_away_score}${def}`)
        })
      }
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════')

  // 4. Vérifier spécifiquement le tournoi BrazilTest
  const brazilTestPreds = allPredictions.filter((p: any) => p.tournaments.name.toLowerCase().includes('brazil'))
  console.log(`\n🇧🇷 Pronostics pour BrazilTest: ${brazilTestPreds.length}`)

  if (brazilTestPreds.length > 0) {
    console.log('\nJournées avec pronostics:')
    const matchdaysSet = new Set(brazilTestPreds.map((p: any) => p.imported_matches.matchday))
    const sortedMatchdays = Array.from(matchdaysSet).sort((a, b) => a - b)
    sortedMatchdays.forEach(md => {
      const count = brazilTestPreds.filter((p: any) => p.imported_matches.matchday === md).length
      console.log(`   J${md}: ${count} pronostics`)
    })
  }

  console.log('')
}

findRomsPredictions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
