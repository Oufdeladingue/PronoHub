/**
 * Script pour vérifier le statut d'un match spécifique
 * Usage: npx tsx scripts/check-match-status.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement manquantes!')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkMatchStatus() {
  console.log('\n🔍 Recherche du match RB Bragantino - EC Vitória...\n')

  // Rechercher le match avec les noms d'équipes
  const { data: matches, error } = await supabase
    .from('imported_matches')
    .select('*')
    .or('home_team_name.ilike.%Bragantino%,away_team_name.ilike.%Bragantino%')
    .or('home_team_name.ilike.%Vitória%,away_team_name.ilike.%Vitória%')

  if (error) {
    console.error('❌ Erreur lors de la recherche:', error)
    return
  }

  if (!matches || matches.length === 0) {
    console.log('⚠️  Aucun match trouvé avec ces équipes.')
    return
  }

  console.log(`✅ ${matches.length} match(s) trouvé(s) :\n`)

  // Filtrer pour trouver le match du 19/11/2025
  const targetDate = new Date('2025-11-19')

  matches.forEach((match, index) => {
    const matchDate = new Date(match.utc_date)
    const isTargetMatch =
      matchDate.toDateString() === targetDate.toDateString() &&
      match.home_team_name.toLowerCase().includes('bragantino') &&
      match.away_team_name.toLowerCase().includes('vitória')

    console.log(`${isTargetMatch ? '🎯' : '📌'} Match ${index + 1}:`)
    console.log(`   ID: ${match.football_data_match_id}`)
    console.log(`   Date: ${matchDate.toLocaleString('fr-FR')}`)
    console.log(`   ${match.home_team_name} vs ${match.away_team_name}`)
    console.log(`   Statut: ${match.status}`)
    console.log(`   Journée: ${match.matchday}`)
    console.log(`   Compétition ID: ${match.competition_id}`)

    if (match.home_score !== null && match.away_score !== null) {
      console.log(`   Score: ${match.home_score} - ${match.away_score}`)
    } else {
      console.log(`   Score: Non disponible`)
    }

    console.log('')
  })

  // Résumé des statuts possibles
  console.log('\n📋 Statuts possibles dans la base:')
  console.log('   • SCHEDULED: Match programmé')
  console.log('   • IN_PLAY: Match en cours')
  console.log('   • PAUSED: Mi-temps')
  console.log('   • FINISHED: Match terminé')
  console.log('   • POSTPONED: Match reporté ⚠️')
  console.log('   • CANCELLED: Match annulé')
  console.log('   • SUSPENDED: Match suspendu')
  console.log('')
}

checkMatchStatus()
  .then(() => {
    console.log('✅ Vérification terminée\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
