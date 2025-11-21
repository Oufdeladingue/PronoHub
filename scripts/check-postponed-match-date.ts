/**
 * Script pour vérifier la date d'un match reporté
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPostponedMatchDate() {
  console.log('\n🔍 Vérification du match RB Bragantino vs EC Vitória (ID: 535269)...\n')

  const { data: match, error } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('football_data_match_id', 535269)
    .single()

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!match) {
    console.log('⚠️  Match non trouvé')
    return
  }

  console.log('📊 Informations du match:')
  console.log('─────────────────────────────────────────────')
  console.log(`🏟️  ${match.home_team_name} vs ${match.away_team_name}`)
  console.log(`📅 Date actuelle dans la DB: ${new Date(match.utc_date).toLocaleString('fr-FR')}`)
  console.log(`⚠️  Statut: ${match.status}`)
  console.log(`🆔 Match ID: ${match.football_data_match_id}`)
  console.log(`🏆 Compétition ID: ${match.competition_id}`)
  console.log(`📌 Journée: ${match.matchday}`)
  console.log('─────────────────────────────────────────────')

  if (match.status === 'POSTPONED') {
    console.log('\n💡 Analyse:')
    console.log('   • Le match est effectivement reporté (POSTPONED)')
    console.log('   • La date affichée est celle actuellement en base')
    console.log('   • Si l\'API connaît la nouvelle date, elle sera mise à jour')
    console.log('   • Lors du prochain import/refresh, la date sera synchronisée')
    console.log('')
    console.log('📝 Recommandation:')
    console.log('   • Afficher "Match reporté" + la date actuelle (si différente)')
    console.log('   • Ajouter un texte "Nouvelle date à confirmer" si nécessaire')
    console.log('   • Désactiver les pronostics tant que statut = POSTPONED')
  }

  console.log('')
}

checkPostponedMatchDate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
