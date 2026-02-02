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

async function simulateFinalize() {
  console.log('🔍 SIMULATION DE FINALISATION\n')

  const now = new Date()

  // Récupérer les tournois avec ending_date dépassée
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .not('ending_date', 'is', null)
    .lte('ending_date', now.toISOString())

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!tournaments || tournaments.length === 0) {
    console.log('✅ Aucun tournoi à finaliser')
    return
  }

  console.log(`📊 ${tournaments.length} tournoi(s) à analyser\n`)
  console.log('─'.repeat(100))

  for (const tournament of tournaments) {
    console.log(`\n🏆 Tournoi: ${tournament.name}`)
    console.log(`   ID: ${tournament.id}`)
    console.log(`   Status: ${tournament.status}`)
    console.log(`   Ending date: ${new Date(tournament.ending_date).toLocaleString('fr-FR')}`)
    console.log(`   Range: J${tournament.starting_matchday} → J${tournament.ending_matchday}`)

    // Analyser les matchs
    if (tournament.custom_competition_id) {
      await analyzeCustomCompetition(tournament)
    } else if (tournament.competition_id) {
      await analyzeImportedCompetition(tournament)
    }

    console.log('─'.repeat(100))
  }

  console.log('\n💡 Aucune modification n\'a été appliquée (mode simulation)')
  console.log('   Pour appliquer les changements, utilisez le script apply-tournament-fixes.mjs\n')
}

async function analyzeCustomCompetition(tournament) {
  const customCompId = tournament.custom_competition_id
  const endingMatchday = tournament.ending_matchday

  // Récupérer les journées
  const { data: matchdays } = await supabase
    .from('custom_competition_matchdays')
    .select('id, matchday_number, status')
    .eq('custom_competition_id', customCompId)
    .lte('matchday_number', endingMatchday)
    .order('matchday_number', { ascending: true })

  if (!matchdays || matchdays.length === 0) {
    console.log('   ⚠️  Aucune journée trouvée')
    return
  }

  console.log(`   📅 ${matchdays.length} journée(s) dans le tournoi`)

  const matchdayIds = matchdays.map(md => md.id)

  // Récupérer tous les matchs
  const { data: allMatches } = await supabase
    .from('custom_competition_matches')
    .select('id, custom_matchday_id, cached_status, cached_utc_date')
    .in('custom_matchday_id', matchdayIds)

  const totalMatches = allMatches?.length || 0

  const finishedMatches = allMatches?.filter(m =>
    m.cached_status === 'FINISHED' || m.cached_status === 'AWARDED'
  ) || []

  const pendingMatches = allMatches?.filter(m =>
    m.cached_status !== 'FINISHED' && m.cached_status !== 'AWARDED'
  ) || []

  console.log(`   ⚽ Matchs: ${totalMatches} total`)
  console.log(`      ✅ Terminés: ${finishedMatches.length}`)
  console.log(`      ⏳ Non terminés: ${pendingMatches.length}`)

  if (pendingMatches.length > 0) {
    console.log(`\n   ⚠️  Matchs non terminés:`)
    const matchdayMap = new Map(matchdays.map(md => [md.id, md.matchday_number]))

    for (const match of pendingMatches.slice(0, 5)) {
      const matchdayNum = matchdayMap.get(match.custom_matchday_id)
      const date = match.cached_utc_date ? new Date(match.cached_utc_date).toLocaleString('fr-FR') : 'Pas de date'
      console.log(`      - J${matchdayNum}: ${match.cached_status || 'PENDING'} - ${date}`)
    }

    if (pendingMatches.length > 5) {
      console.log(`      ... et ${pendingMatches.length - 5} autre(s)`)
    }
  }

  // Décision
  if (pendingMatches.length === 0) {
    console.log(`\n   ✅ DÉCISION: Peut être finalisé (tous les matchs terminés)`)
  } else {
    console.log(`\n   🔄 DÉCISION: Recalculer ending_date (${pendingMatches.length} match(s) non terminé(s))`)
  }
}

async function analyzeImportedCompetition(tournament) {
  const competitionId = tournament.competition_id
  const startingMatchday = tournament.starting_matchday || 1
  const endingMatchday = tournament.ending_matchday

  // Récupérer UNIQUEMENT les matchs dans la plage choisie
  const { data: allMatches } = await supabase
    .from('imported_matches')
    .select('id, matchday, status, stage, utc_date, home_team_name, away_team_name')
    .eq('competition_id', competitionId)
    .gte('matchday', startingMatchday)
    .lte('matchday', endingMatchday)
    .order('matchday', { ascending: true })

  const totalMatches = allMatches?.length || 0

  const finishedMatches = allMatches?.filter(m =>
    m.status === 'FINISHED' || m.status === 'AWARDED'
  ) || []

  const pendingMatches = allMatches?.filter(m =>
    m.status !== 'FINISHED' && m.status !== 'AWARDED'
  ) || []

  // Détecter knockout
  const knockoutStages = ['LAST_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'PLAYOFFS']
  const hasKnockout = allMatches?.some(m => m.stage && knockoutStages.includes(m.stage))

  console.log(`   ⚽ Matchs: ${totalMatches} total`)
  console.log(`   🏆 Type: ${hasKnockout ? 'Élimination directe' : 'Championnat'}`)
  console.log(`      ✅ Terminés: ${finishedMatches.length}`)
  console.log(`      ⏳ Non terminés: ${pendingMatches.length}`)

  if (pendingMatches.length > 0) {
    console.log(`\n   ⚠️  Matchs non terminés:`)

    for (const match of pendingMatches.slice(0, 5)) {
      const date = match.utc_date ? new Date(match.utc_date).toLocaleString('fr-FR') : 'Pas de date'
      const stage = match.stage || ''
      const stageInfo = stage ? ` [${stage}]` : ''
      console.log(`      - J${match.matchday}${stageInfo}: ${match.home_team_name} vs ${match.away_team_name}`)
      console.log(`        Status: ${match.status || 'SCHEDULED'} - ${date}`)
    }

    if (pendingMatches.length > 5) {
      console.log(`      ... et ${pendingMatches.length - 5} autre(s)`)
    }
  }

  // Statistiques par journée
  const matchesByMatchday = new Map()
  for (const match of allMatches || []) {
    if (!matchesByMatchday.has(match.matchday)) {
      matchesByMatchday.set(match.matchday, { total: 0, finished: 0 })
    }
    const stats = matchesByMatchday.get(match.matchday)
    stats.total++
    if (match.status === 'FINISHED' || match.status === 'AWARDED') {
      stats.finished++
    }
  }

  console.log(`\n   📊 Progression par journée:`)
  const sortedMatchdays = Array.from(matchesByMatchday.entries()).sort((a, b) => a[0] - b[0])
  for (const [matchday, stats] of sortedMatchdays) {
    const percentage = Math.round((stats.finished / stats.total) * 100)
    const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10))
    console.log(`      J${matchday}: ${bar} ${stats.finished}/${stats.total} (${percentage}%)`)
  }

  // Décision
  if (pendingMatches.length === 0) {
    console.log(`\n   ✅ DÉCISION: Peut être finalisé (tous les matchs terminés)`)
  } else {
    console.log(`\n   🔄 DÉCISION: Recalculer ending_date (${pendingMatches.length} match(s) non terminé(s))`)
  }
}

simulateFinalize()
  .then(() => {
    console.log('✅ Simulation terminée')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erreur fatale:', err)
    process.exit(1)
  })
