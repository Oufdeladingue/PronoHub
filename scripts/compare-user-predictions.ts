/**
 * Script pour comparer les pronostics de Rom's vs joueur2long
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function comparePredictions() {
  console.log('\n🔍 Comparaison des pronostics Roms vs joueur2long pour J34...\n')

  // 1. Trouver le tournoi
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, competition_id')
    .ilike('name', '%BrazilTest%')
    .single()

  if (!tournament) {
    console.error('❌ Tournoi non trouvé')
    return
  }

  console.log(`✅ Tournoi: ${tournament.name} (ID: ${tournament.id})`)
  console.log('')

  // 2. Trouver les utilisateurs
  const { data: roms } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%rom%')
    .single()

  const { data: joueur2 } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%joueur2long%')
    .single()

  if (!roms || !joueur2) {
    console.error('❌ Utilisateurs non trouvés')
    return
  }

  console.log(`👤 Roms ID: ${roms.id}`)
  console.log(`👤 joueur2long ID: ${joueur2.id}`)
  console.log('')

  // 3. Récupérer les matchs J34
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('id, home_team_name, away_team_name, status, home_score, away_score, utc_date')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 34)
    .order('utc_date', { ascending: true })

  if (!matches) {
    console.error('❌ Aucun match trouvé')
    return
  }

  console.log(`✅ ${matches.length} matchs trouvés pour J34`)
  console.log('')

  // 4. Récupérer les pronostics de Rom's
  const { data: romsPredictions } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at, updated_at')
    .eq('tournament_id', tournament.id)
    .eq('user_id', roms.id)
    .in('match_id', matches.map(m => m.id))

  // 5. Récupérer les pronostics de joueur2long
  const { data: joueur2Predictions } = await supabase
    .from('predictions')
    .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at, updated_at')
    .eq('tournament_id', tournament.id)
    .eq('user_id', joueur2.id)
    .in('match_id', matches.map(m => m.id))

  console.log('📊 COMPARAISON DES PRONOSTICS:')
  console.log('══════════════════════════════════════════════════════════════════')

  const romsMap = new Map(romsPredictions?.map(p => [p.match_id, p]))
  const joueur2Map = new Map(joueur2Predictions?.map(p => [p.match_id, p]))

  for (const match of matches) {
    const romsPred = romsMap.get(match.id)
    const joueur2Pred = joueur2Map.get(match.id)

    console.log(`\n🏟️  ${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`   Match ID: ${match.id}`)
    console.log(`   Status: ${match.status}`)
    console.log(`   Date: ${new Date(match.utc_date).toLocaleString('fr-FR')}`)

    if (match.home_score !== null && match.away_score !== null) {
      console.log(`   Score réel: ${match.home_score}-${match.away_score}`)
    }

    // Roms
    if (romsPred) {
      console.log(`   👤 Roms: ${romsPred.predicted_home_score}-${romsPred.predicted_away_score}${romsPred.is_default_prediction ? ' (DÉFAUT)' : ''}`)
      console.log(`      Créé: ${new Date(romsPred.created_at).toLocaleString('fr-FR')}`)
    } else {
      console.log(`   👤 Roms: ❌ AUCUN PRONOSTIC`)
    }

    // joueur2long
    if (joueur2Pred) {
      console.log(`   👤 joueur2long: ${joueur2Pred.predicted_home_score}-${joueur2Pred.predicted_away_score}${joueur2Pred.is_default_prediction ? ' (DÉFAUT)' : ''}`)
      console.log(`      Créé: ${new Date(joueur2Pred.created_at).toLocaleString('fr-FR')}`)
    } else {
      console.log(`   👤 joueur2long: ❌ AUCUN PRONOSTIC`)
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════════')
  console.log(`📈 Roms: ${romsPredictions?.length || 0}/${matches.length} pronostics`)
  console.log(`📈 joueur2long: ${joueur2Predictions?.length || 0}/${matches.length} pronostics`)
  console.log('')

  // 6. Analyse des différences
  if (romsPredictions && romsPredictions.length > 0) {
    const defaultCount = romsPredictions.filter(p => p.is_default_prediction).length
    console.log(`💡 Roms a ${defaultCount} pronostic(s) par défaut sur ${romsPredictions.length}`)
  }

  console.log('')
}

comparePredictions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
