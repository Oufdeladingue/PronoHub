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
    const userId = '01b0ec3e-7f3d-458d-ba8d-9efae1c2bf06' // kochroman6@gmail.com
    const trophyType = 'cursed'
    const unlockedAt = '2026-01-29T21:34:39.094+00:00'
    const unlockDate = new Date(unlockedAt)

    console.log('Testing trophy API...')
    console.log('User ID:', userId)
    console.log('Trophy Type:', trophyType)
    console.log('Unlock Date:', unlockDate)

    // Simuler findLastPredictedMatch pour "cursed"
    console.log('\n1. Recherche des predictions...')
    const { data: predictions, error: predError } = await supabase
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
      .limit(10)

    if (predError) {
      console.error('Erreur predictions:', predError)
      return
    }

    console.log(`Trouvé ${predictions?.length || 0} predictions`)

    if (!predictions || predictions.length === 0) {
      console.log('❌ Aucune prediction trouvée')
      return
    }

    // Tester la première prediction
    const pred = predictions[0]
    console.log('\n2. Première prediction:', pred)

    // Tester getMatchDetails
    console.log('\n3. Récupération des détails du match...')

    if (pred.tournaments.custom_competition_id) {
      console.log('Match custom...')
      const { data: matches, error: matchError } = await supabase
        .from('custom_competition_matches')
        .select('*')
        .eq('id', pred.match_id)
        .limit(1)

      console.log('Résultat:', matchError || matches)
    } else {
      console.log('Match importé...')
      const { data: matches, error: matchError } = await supabase
        .from('imported_matches')
        .select('*')
        .eq('id', pred.match_id)
        .limit(1)

      if (matchError) {
        console.error('Erreur match:', matchError)
        return
      }

      if (!matches || matches.length === 0) {
        console.log('❌ Match non trouvé')
        return
      }

      const match = matches[0]
      console.log('Match trouvé:', match)

      // Tester la récupération des équipes
      console.log('\n4. Récupération des équipes...')
      const [homeTeam, awayTeam] = await Promise.all([
        supabase.from('imported_teams').select('name, logo').eq('id', match.home_team_id).limit(1),
        supabase.from('imported_teams').select('name, logo').eq('id', match.away_team_id).limit(1)
      ])

      console.log('Home team:', homeTeam)
      console.log('Away team:', awayTeam)

      if (homeTeam.error || awayTeam.error) {
        console.error('Erreur teams:', homeTeam.error || awayTeam.error)
        return
      }

      const result = {
        home_team_name: homeTeam.data?.[0]?.name || 'Équipe',
        away_team_name: awayTeam.data?.[0]?.name || 'Équipe',
        home_team_logo: homeTeam.data?.[0]?.logo,
        away_team_logo: awayTeam.data?.[0]?.logo,
        competition_id: pred.tournaments.competition_id
      }

      console.log('\n✅ Résultat final:', result)
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Stack:', error.stack)
  }
}

testTrophyAPI()
