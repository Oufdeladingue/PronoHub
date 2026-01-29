const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugMatch() {
  try {
    const matchId = '8525e68d-a728-4459-b3e9-3db592dbfff5'

    console.log('=== DEBUG MATCH ===')
    console.log('Match ID:', matchId)

    // 1. Récupérer le match
    const { data: matches, error: err1 } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('id', matchId)
      .limit(1)

    if (err1) {
      console.error('Erreur match:', err1)
      return
    }

    if (!matches || matches.length === 0) {
      console.log('❌ Match non trouvé')
      return
    }

    const match = matches[0]
    console.log('\nMatch trouvé:')
    console.log('  Competition ID:', match.competition_id)
    console.log('  Home Team ID:', match.home_team_id)
    console.log('  Away Team ID:', match.away_team_id)
    console.log('  Status:', match.status)
    console.log('  Date:', match.utc_date)

    // 2. Chercher les équipes
    console.log('\nRecherche équipes...')
    const [homeTeam, awayTeam] = await Promise.all([
      supabase.from('imported_teams').select('*').eq('id', match.home_team_id),
      supabase.from('imported_teams').select('*').eq('id', match.away_team_id)
    ])

    console.log('\nHome Team:')
    console.log('  Error:', homeTeam.error)
    console.log('  Data:', homeTeam.data)

    console.log('\nAway Team:')
    console.log('  Error:', awayTeam.error)
    console.log('  Data:', awayTeam.data)

    // 3. Vérifier si le match a home_team_name/away_team_name directement
    console.log('\nChamps directs du match:')
    console.log('  home_team_name:', match.home_team_name)
    console.log('  away_team_name:', match.away_team_name)
    console.log('  home_team_logo:', match.home_team_logo)
    console.log('  away_team_logo:', match.away_team_logo)

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Stack:', error.stack)
  }
}

debugMatch()
