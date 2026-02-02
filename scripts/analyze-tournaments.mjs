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

async function analyzeTournaments() {
  console.log('🔍 Analyse des tournois existants...\n')

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
    console.log('✅ Aucun tournoi actif ou en warmup trouvé')
    return
  }

  console.log(`📊 ${tournaments.length} tournoi(s) trouvé(s)\n`)

  const now = new Date()
  const analyses = []

  for (const t of tournaments) {
    const planned = t.planned_matchdays || t.num_matchdays || 0
    const actual = t.actual_matchdays
    const starting = t.starting_matchday
    const ending = t.ending_matchday
    const endingDate = t.ending_date

    let endingDateStatus = 'null'
    if (endingDate) {
      endingDateStatus = new Date(endingDate) < now ? 'passed' : 'future'
    }

    let recommendation = 'already_correct'
    if (t.status === 'warmup') {
      recommendation = 'keep_warmup'
    } else if (endingDateStatus === 'passed') {
      recommendation = 'finalize'
    } else if (endingDateStatus === 'null') {
      recommendation = 'recalculate'
    }

    analyses.push({
      name: t.name,
      status: t.status,
      planned,
      actual,
      starting,
      ending,
      endingDate,
      endingDateStatus,
      recommendation
    })
  }

  console.log('📋 RÉSUMÉ\n')
  console.log('─'.repeat(100))

  const toFinalize = analyses.filter(a => a.recommendation === 'finalize')
  const toRecalculate = analyses.filter(a => a.recommendation === 'recalculate')
  const toKeep = analyses.filter(a => a.recommendation === 'keep_warmup')
  const alreadyCorrect = analyses.filter(a => a.recommendation === 'already_correct')

  console.log(`\n🏁 À finaliser (ending_date dépassée): ${toFinalize.length}`)
  toFinalize.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    console.log(`     Journées: planifiées=${a.planned}, réelles=${a.actual || 'N/A'}`)
    console.log(`     Range: J${a.starting} → J${a.ending}`)
    console.log(`     Ending date: ${a.endingDate ? new Date(a.endingDate).toLocaleString('fr-FR') : 'null'}`)
  })

  console.log(`\n🔄 À recalculer (pas de ending_date): ${toRecalculate.length}`)
  toRecalculate.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    console.log(`     Journées: planifiées=${a.planned}, réelles=${a.actual || 'N/A'}`)
    console.log(`     Range: J${a.starting || '?'} → J${a.ending || '?'}`)
  })

  console.log(`\n⏸️  À garder en warmup: ${toKeep.length}`)
  toKeep.forEach(a => {
    console.log(`   - ${a.name}`)
  })

  console.log(`\n✅ Déjà corrects: ${alreadyCorrect.length}`)
  alreadyCorrect.forEach(a => {
    console.log(`   - ${a.name} (${a.status})`)
    if (a.endingDate) {
      console.log(`     Ending date: ${new Date(a.endingDate).toLocaleString('fr-FR')}`)
    }
  })

  console.log('\n' + '─'.repeat(100))
}

analyzeTournaments()
  .then(() => {
    console.log('\n✅ Analyse terminée')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erreur:', err)
    process.exit(1)
  })
