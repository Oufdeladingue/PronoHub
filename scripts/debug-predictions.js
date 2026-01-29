const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugPredictions() {
  try {
    const userId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06'
    const unlockDate = new Date('2026-01-29T21:34:39.094+00:00')

    console.log('=== DEBUG PREDICTIONS ===')
    console.log('User ID:', userId)
    console.log('Unlock Date:', unlockDate)

    // 1. Chercher des predictions sur des matchs IMPORTÉS
    console.log('\n1. Predictions sur matchs IMPORTÉS:')
    const { data: importedPreds, error: err1 } = await supabase
      .from('predictions')
      .select(`
        match_id,
        created_at,
        tournaments!inner (
          competition_id,
          custom_competition_id
        )
      `)
      .eq('user_id', userId)
      .is('tournaments.custom_competition_id', null) // Seulement les matchs importés
      .not('tournaments.competition_id', 'is', null)
      .lte('created_at', unlockDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(10)

    if (err1) console.error('Erreur:', err1)
    console.log(`Trouvé ${importedPreds?.length || 0} predictions sur matchs importés`)
    if (importedPreds && importedPreds.length > 0) {
      importedPreds.forEach((p, i) => {
        console.log(`  ${i + 1}. Match ${p.match_id} - Competition ${p.tournaments.competition_id}`)
      })
    }

    // 2. Fallback: tous les matchs importés terminés
    console.log('\n2. Fallback: matchs importés terminés avant unlock:')
    const { data: matches, error: err2 } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('status', 'FINISHED')
      .lte('utc_date', unlockDate.toISOString())
      .order('utc_date', { ascending: false })
      .limit(5)

    if (err2) console.error('Erreur:', err2)
    console.log(`Trouvé ${matches?.length || 0} matchs importés terminés`)
    if (matches && matches.length > 0) {
      for (const match of matches) {
        // Récupérer les équipes
        const [homeTeam, awayTeam] = await Promise.all([
          supabase.from('imported_teams').select('name, logo').eq('id', match.home_team_id).limit(1),
          supabase.from('imported_teams').select('name, logo').eq('id', match.away_team_id).limit(1)
        ])

        console.log(`  - ${homeTeam.data?.[0]?.name || '?'} vs ${awayTeam.data?.[0]?.name || '?'} (${match.utc_date})`)
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Stack:', error.stack)
  }
}

debugPredictions()
