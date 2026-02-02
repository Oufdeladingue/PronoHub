import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function applyFixes() {
  console.log('🔧 APPLICATION DES CORRECTIONS AUX TOURNOIS\n')

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'warmup'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!tournaments || tournaments.length === 0) {
    console.log('✅ Aucun tournoi à corriger')
    return
  }

  const now = new Date()
  const toFinalize = []
  const toRecalculate = []

  // Analyser les tournois
  for (const t of tournaments) {
    const endingDate = t.ending_date
    let endingDateStatus = 'null'

    if (endingDate) {
      endingDateStatus = new Date(endingDate) < now ? 'passed' : 'future'
    }

    if (t.status === 'active' && endingDateStatus === 'passed') {
      toFinalize.push(t)
    } else if (t.status === 'active' && endingDateStatus === 'null') {
      toRecalculate.push(t)
    }
  }

  console.log(`🏁 ${toFinalize.length} tournoi(s) à finaliser`)
  console.log(`🔄 ${toRecalculate.length} tournoi(s) à recalculer\n`)

  // 1. Finaliser les tournois avec ending_date dépassée
  for (const tournament of toFinalize) {
    console.log(`\n🏁 Traitement de: ${tournament.name}`)

    // Vérifier si tous les matchs sont terminés
    const allMatchesFinished = await checkAllMatchesFinished(tournament)

    if (allMatchesFinished) {
      console.log('   ✅ Tous les matchs sont terminés')

      const { error: updateError } = await supabase
        .from('tournaments')
        .update({
          status: 'completed',
          end_date: new Date().toISOString()
        })
        .eq('id', tournament.id)

      if (updateError) {
        console.error(`   ❌ Erreur de mise à jour: ${updateError.message}`)
      } else {
        console.log(`   ✅ Tournoi finalisé avec succès`)
      }
    } else {
      console.log('   ⚠️  Des matchs ne sont pas terminés')
      console.log('   ℹ️  Le cron finalize-tournaments recalculera la ending_date automatiquement')
    }
  }

  // 2. Calculer les ending_date manquantes via l'API
  for (const tournament of toRecalculate) {
    console.log(`\n🔄 Recalcul pour: ${tournament.name}`)
    console.log(`   Range: J${tournament.starting_matchday} → J${tournament.ending_matchday}`)

    try {
      // Utiliser l'API locale pour calculer la ending_date
      // Note: Ceci nécessite que le serveur Next.js soit en cours d'exécution
      console.log(`   ℹ️  Calcul manuel nécessaire ou utiliser l'API`)
      console.log(`   💡 Démarrez votre serveur et appelez: POST /api/tournaments/${tournament.id}/recalculate-ending-date`)
    } catch (error) {
      console.error(`   ❌ Erreur: ${error.message}`)
    }
  }

  console.log('\n' + '─'.repeat(80))
  console.log('\n✅ Corrections terminées!')
  console.log('\n📝 Note: Pour les tournois à recalculer, vous pouvez:')
  console.log('   1. Attendre le prochain cron update-matches qui mettra à jour les dates')
  console.log('   2. Les ending_date seront calculées automatiquement au prochain démarrage de tournoi')
}

async function checkAllMatchesFinished(tournament) {
  const endingMatchday = tournament.ending_matchday

  if (tournament.custom_competition_id) {
    // Compétition custom
    const { data: matchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('id')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .lte('matchday_number', endingMatchday)

    if (!matchdays || matchdays.length === 0) return true

    const matchdayIds = matchdays.map(md => md.id)

    const { data: unfinishedMatches } = await supabase
      .from('custom_competition_matches')
      .select('id')
      .in('custom_matchday_id', matchdayIds)
      .not('cached_status', 'in', '("FINISHED","AWARDED")')
      .limit(1)

    return !unfinishedMatches || unfinishedMatches.length === 0

  } else if (tournament.competition_id) {
    // Compétition importée
    const { data: unfinishedMatches } = await supabase
      .from('imported_matches')
      .select('id')
      .eq('competition_id', tournament.competition_id)
      .lte('matchday', endingMatchday)
      .not('status', 'in', '("FINISHED","AWARDED")')
      .limit(1)

    return !unfinishedMatches || unfinishedMatches.length === 0
  }

  return true
}

applyFixes()
  .then(() => {
    console.log('\n✅ Script terminé')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erreur fatale:', err)
    process.exit(1)
  })
