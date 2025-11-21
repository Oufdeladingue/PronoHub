/**
 * Script pour vérifier toutes les prédictions du tournoi BrazilTest
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAllPredictions() {
  console.log('\n🔍 Vérification de TOUTES les prédictions du tournoi BrazilTest...\n')

  // 1. Trouver le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%BrazilTest%')
    .single()

  if (!tournament) {
    console.error('❌ Tournoi non trouvé')
    return
  }

  console.log(`✅ Tournoi: ${tournament.name}`)
  console.log(`   ID: ${tournament.id}`)
  console.log(`   Journées: J${tournament.starting_matchday} à J${tournament.ending_matchday}`)
  console.log('')

  // 2. Récupérer tous les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles!inner(username)')
    .eq('tournament_id', tournament.id)

  if (!participants) {
    console.error('❌ Aucun participant trouvé')
    return
  }

  console.log(`👥 ${participants.length} participants:`)
  participants.forEach(p => {
    console.log(`   - ${(p as any).profiles.username} (${p.user_id})`)
  })
  console.log('')

  // 3. Pour chaque journée, compter les pronostics
  console.log('📊 PRONOSTICS PAR JOURNÉE:')
  console.log('══════════════════════════════════════════════════════════════')

  for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
    // Compter les matchs
    const { count: matchCount } = await supabase
      .from('imported_matches')
      .select('*', { count: 'exact', head: true })
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    if (!matchCount || matchCount === 0) {
      console.log(`\nJ${matchday}: Aucun match`)
      continue
    }

    console.log(`\n📅 J${matchday} (${matchCount} matchs):`)

    // Pour chaque participant, compter ses pronostics
    for (const participant of participants) {
      const { count: predCount, data: predictions } = await supabase
        .from('predictions')
        .select('*, imported_matches!inner(matchday)', { count: 'exact' })
        .eq('tournament_id', tournament.id)
        .eq('user_id', participant.user_id)
        .eq('imported_matches.matchday', matchday)

      const defaultCount = predictions?.filter(p => p.is_default_prediction).length || 0
      const customCount = (predCount || 0) - defaultCount

      const status = (predCount || 0) === matchCount ? '✅' : (predCount || 0) === 0 ? '❌' : '⚠️ '
      console.log(`   ${status} ${(participant as any).profiles.username}: ${predCount}/${matchCount} pronostics (${customCount} personnalisés, ${defaultCount} par défaut)`)
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════')

  // 4. Résumé global
  console.log('\n📈 RÉSUMÉ GLOBAL:')
  for (const participant of participants) {
    const { count: totalPredictions } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)
      .eq('user_id', participant.user_id)

    console.log(`   ${(participant as any).profiles.username}: ${totalPredictions || 0} pronostics au total`)
  }

  console.log('')
}

checkAllPredictions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
