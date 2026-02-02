import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TournamentAnalysis {
  id: string
  name: string
  status: string
  planned_matchdays: number
  actual_matchdays: number | null
  starting_matchday: number | null
  ending_matchday: number | null
  ending_date: string | null
  current_ending_date_status: 'passed' | 'future' | 'null'
  recommendation: 'finalize' | 'recalculate' | 'keep_active' | 'already_correct'
}

async function analyzeAndFixTournaments() {
  console.log('🔍 Analyse des tournois existants...\n')

  try {
    // Récupérer tous les tournois actifs et warmup
    const { data: tournaments, error } = await supabase
      .from('tournaments')
      .select('*')
      .in('status', ['active', 'warmup'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Erreur lors de la récupération des tournois:', error)
      console.error('Détails:', error)
      return
    }

  if (!tournaments || tournaments.length === 0) {
    console.log('✅ Aucun tournoi actif ou en warmup trouvé')
    return
  }

  console.log(`📊 ${tournaments.length} tournoi(s) trouvé(s)\n`)

  const analyses: TournamentAnalysis[] = []
  const now = new Date()

  // Analyser chaque tournoi
  for (const tournament of tournaments) {
    const planned = tournament.planned_matchdays || tournament.num_matchdays || 0
    const actual = tournament.actual_matchdays
    const starting = tournament.starting_matchday
    const ending = tournament.ending_matchday
    const endingDate = tournament.ending_date

    let endingDateStatus: 'passed' | 'future' | 'null' = 'null'
    if (endingDate) {
      endingDateStatus = new Date(endingDate) < now ? 'passed' : 'future'
    }

    let recommendation: TournamentAnalysis['recommendation'] = 'already_correct'

    // Déterminer la recommandation
    if (tournament.status === 'warmup') {
      recommendation = 'keep_active' // Les warmup restent en warmup
    } else if (endingDateStatus === 'passed') {
      recommendation = 'finalize' // Date passée = finaliser
    } else if (endingDateStatus === 'null') {
      recommendation = 'recalculate' // Pas de date = recalculer
    } else {
      recommendation = 'already_correct' // Date future = OK
    }

    analyses.push({
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      planned_matchdays: planned,
      actual_matchdays: actual,
      starting_matchday: starting,
      ending_matchday: ending,
      ending_date: endingDate,
      current_ending_date_status: endingDateStatus,
      recommendation
    })
  }

  // Afficher le résumé
  console.log('📋 ANALYSE DES TOURNOIS\n')
  console.log('─'.repeat(120))

  const toFinalize = analyses.filter(a => a.recommendation === 'finalize')
  const toRecalculate = analyses.filter(a => a.recommendation === 'recalculate')
  const toKeep = analyses.filter(a => a.recommendation === 'keep_active')
  const alreadyCorrect = analyses.filter(a => a.recommendation === 'already_correct')

  console.log(`\n🏁 À finaliser (ending_date dépassée): ${toFinalize.length}`)
  toFinalize.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    console.log(`     Journées: planifiées=${a.planned_matchdays}, réelles=${a.actual_matchdays || 'N/A'}`)
    console.log(`     Range: J${a.starting_matchday} → J${a.ending_matchday}`)
    console.log(`     Ending date: ${a.ending_date ? new Date(a.ending_date).toLocaleString('fr-FR') : 'null'}`)
  })

  console.log(`\n🔄 À recalculer (pas de ending_date): ${toRecalculate.length}`)
  toRecalculate.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    console.log(`     Journées: planifiées=${a.planned_matchdays}, réelles=${a.actual_matchdays || 'N/A'}`)
    console.log(`     Range: J${a.starting_matchday || '?'} → J${a.ending_matchday || '?'}`)
  })

  console.log(`\n⏸️  À garder en warmup: ${toKeep.length}`)
  toKeep.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
  })

  console.log(`\n✅ Déjà corrects: ${alreadyCorrect.length}`)
  alreadyCorrect.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    console.log(`     Ending date: ${a.ending_date ? new Date(a.ending_date).toLocaleString('fr-FR') : 'null'}`)
  })

  console.log('\n' + '─'.repeat(120))

  // Demander confirmation (en mode script, on simule juste)
  console.log('\n⚠️  MODE DRY-RUN: Aucune modification ne sera appliquée')
  console.log('💡 Pour appliquer les corrections, décommentez la section "APPLY FIXES" dans le script\n')

  // APPLY FIXES - Décommenter pour appliquer les corrections
  // Pour appliquer les corrections, utilisez la route API /api/cron/finalize-tournaments
  // ou modifiez manuellement les tournois dans Supabase

  } catch (error: any) {
    console.error('❌ Erreur dans analyzeAndFixTournaments:', error)
    throw error
  }
}

async function checkAllMatchesFinished(tournamentId: string, tournament: any): Promise<boolean> {
  const endingMatchday = tournament.ending_matchday

  if (tournament.custom_competition_id) {
    // Compétition custom
    const { data: matchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('id')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .lte('matchday_number', endingMatchday)

    if (!matchdays || matchdays.length === 0) return true

    const matchdayIds = matchdays.map((md: any) => md.id)

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

// Exécuter le script
analyzeAndFixTournaments()
  .then(() => {
    console.log('✅ Analyse terminée')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
  })
