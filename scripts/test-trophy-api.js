const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testTrophyAPI() {
  try {
    const userId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06'
    const trophyType = 'cursed'
    const unlockedAt = '2026-01-29T21:34:39.094+00:00'

    console.log('=== TEST TROPHY API ===')
    console.log('User ID:', userId)
    console.log('Trophy Type:', trophyType)
    console.log('Unlocked At:', unlockedAt)

    const unlockDate = new Date(unlockedAt)
    console.log('\nDate de déblocage:', unlockDate)

    // Simuler findLastPredictedMatch
    console.log('\n1. Chercher dans predictions...')
    const { data: predictions } = await supabase
      .from('predictions')
      .select(`
        match_id,
        tournament_id,
        tournaments!inner (
          competition_id,
          custom_competition_id
        )
      `)
      .eq('user_id', userId)
      .lte('created_at', unlockDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    console.log(`Predictions trouvées: ${predictions?.length || 0}`)

    // Fallback: matchs importés
    console.log('\n2. Fallback: matchs importés terminés...')
    const { data: importedMatches, error } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('status', 'FINISHED')
      .lte('utc_date', unlockDate.toISOString())
      .order('utc_date', { ascending: false })
      .limit(1)

    console.log('\nRésultat fallback:')
    console.log('  Found:', importedMatches?.length || 0)
    console.log('  Error:', error?.message || 'none')

    if (importedMatches && importedMatches.length > 0) {
      const match = importedMatches[0]
      console.log('\nMatch trouvé:')
      console.log('  ID:', match.id)
      console.log('  Home Team Name:', match.home_team_name)
      console.log('  Away Team Name:', match.away_team_name)
      console.log('  Home Team Crest:', match.home_team_crest)
      console.log('  Away Team Crest:', match.away_team_crest)
      console.log('  Competition ID:', match.competition_id)
      console.log('  Status:', match.status)
      console.log('  Date:', match.utc_date)

      const result = {
        home_team_name: match.home_team_name || 'Équipe',
        away_team_name: match.away_team_name || 'Équipe',
        home_team_crest: match.home_team_crest,
        away_team_crest: match.away_team_crest,
        competition_id: match.competition_id
      }

      console.log('\n✅ Résultat final:')
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log('\n❌ Aucun match trouvé')
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Stack:', error.stack)
  }
}

testTrophyAPI()
