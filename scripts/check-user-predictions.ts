/**
 * Script pour vérifier les pronostics d'un utilisateur dans un tournoi
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

async function checkUserPredictions() {
  console.log('\n🔍 Recherche du tournoi BrazilTest et de l\'utilisateur joueur2long...\n')

  // 1. Trouver le tournoi BrazilTest
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, slug, competition_id, starting_matchday, ending_matchday')
    .ilike('name', '%BrazilTest%')
    .single()

  if (tournamentError || !tournament) {
    console.error('❌ Tournoi BrazilTest non trouvé:', tournamentError)
    return
  }

  console.log('✅ Tournoi trouvé:', tournament.name)
  console.log(`   ID: ${tournament.id}`)
  console.log(`   Competition ID: ${tournament.competition_id}`)
  console.log(`   Journées: ${tournament.starting_matchday} - ${tournament.ending_matchday}`)
  console.log('')

  // 2. Trouver l'utilisateur joueur2long
  const { data: user, error: userError } = await supabase
    .from('profiles')
    .select('id, username')
    .ilike('username', '%joueur2long%')
    .single()

  if (userError || !user) {
    console.error('❌ Utilisateur joueur2long non trouvé:', userError)
    return
  }

  console.log('✅ Utilisateur trouvé:', user.username)
  console.log(`   ID: ${user.id}`)
  console.log('')

  // 3. Vérifier s'il est participant du tournoi
  const { data: participation, error: participationError } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('user_id', user.id)
    .single()

  if (participationError || !participation) {
    console.error('❌ L\'utilisateur n\'est pas participant du tournoi:', participationError)
    return
  }

  console.log('✅ Participation confirmée')
  console.log('')

  // 4. Récupérer les matchs de la journée 34
  const { data: matches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', tournament.competition_id)
    .eq('matchday', 34)
    .order('utc_date', { ascending: true })

  if (matchesError || !matches || matches.length === 0) {
    console.error('❌ Aucun match trouvé pour la journée 34:', matchesError)
    return
  }

  console.log(`✅ ${matches.length} matchs trouvés pour la journée 34`)
  console.log('')

  // 5. Vérifier les pronostics de joueur2long pour chaque match
  console.log('📊 Vérification des pronostics de joueur2long pour J34:')
  console.log('─────────────────────────────────────────────────────────────')

  let predictionsCount = 0
  let defaultPredictionsCount = 0

  for (const match of matches) {
    const { data: prediction, error: predictionError } = await supabase
      .from('predictions')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .eq('match_id', match.id)
      .maybeSingle()

    const matchInfo = `${match.home_team_name} vs ${match.away_team_name}`

    if (prediction) {
      predictionsCount++
      const isDefault = prediction.is_default_prediction
      if (isDefault) defaultPredictionsCount++

      console.log(`${isDefault ? '⚠️ ' : '✅'} ${matchInfo}`)
      console.log(`   Score: ${prediction.predicted_home_score}-${prediction.predicted_away_score}`)
      console.log(`   ${isDefault ? 'DÉFAUT (0-0)' : 'Pronostic saisi'}`)
    } else {
      console.log(`❌ ${matchInfo}`)
      console.log(`   Aucun pronostic (ni saisi, ni par défaut)`)
    }
    console.log('')
  }

  console.log('─────────────────────────────────────────────────────────────')
  console.log(`📈 Résumé:`)
  console.log(`   Total matchs J34: ${matches.length}`)
  console.log(`   Pronostics enregistrés: ${predictionsCount}`)
  console.log(`   Pronostics par défaut (0-0): ${defaultPredictionsCount}`)
  console.log(`   Pronostics manquants: ${matches.length - predictionsCount}`)
  console.log('')

  if (predictionsCount < matches.length) {
    console.log('⚠️  PROBLÈME DÉTECTÉ:')
    console.log('   Des pronostics par défaut n\'ont pas été créés!')
    console.log('   Ces matchs n\'apparaîtront pas dans la vue "adversaires"')
    console.log('')
  }

  // 6. Vérifier tous les participants pour comparaison
  console.log('👥 Comparaison avec les autres participants:')
  console.log('─────────────────────────────────────────────────────────────')

  const { data: allParticipants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles!inner(username)')
    .eq('tournament_id', tournament.id)

  if (allParticipants) {
    for (const participant of allParticipants) {
      const { count } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)
        .eq('user_id', participant.user_id)
        .in('match_id', matches.map(m => m.id))

      console.log(`${(participant as any).profiles.username}: ${count}/${matches.length} pronostics`)
    }
  }

  console.log('')
}

checkUserPredictions()
  .then(() => {
    console.log('✅ Vérification terminée\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
