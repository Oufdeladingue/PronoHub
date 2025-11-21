require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugKingSituation() {
  try {
    console.log('=== ANALYSE DE LA SITUATION KING OF DAY ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username)
    console.log('ID:', user.id, '\n')

    // Récupérer tous les tournois de Rom's
    const { data: tournaments } = await supabase
      .from('tournament_participants')
      .select(`
        tournament_id,
        tournaments (
          id,
          name,
          competition_id,
          starting_matchday,
          ending_matchday
        )
      `)
      .eq('user_id', user.id)

    for (const tp of tournaments || []) {
      const tournament = tp.tournaments
      if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

      console.log(`\n=== ${tournament.name} ===`)

      // Récupérer tous les participants
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id, profiles(username)')
        .eq('tournament_id', tournament.id)

      console.log(`Participants: ${participants?.length}`)
      participants?.forEach(p => console.log(`  - ${p.profiles?.username}`))

      const userIds = participants?.map(p => p.user_id) || []

      // Vérifier chaque journée
      for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
        const { data: journeyMatches } = await supabase
          .from('imported_matches')
          .select('id, status, finished, home_score, away_score')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', matchday)

        if (!journeyMatches || journeyMatches.length === 0) continue

        const allMatchesFinished = journeyMatches.every(m =>
          (m.status === 'FINISHED' || m.finished === true) &&
          m.home_score !== null &&
          m.away_score !== null
        )

        if (!allMatchesFinished) continue

        const matchIds = journeyMatches.map(m => m.id)

        const { data: journeyPredictions } = await supabase
          .from('predictions')
          .select('user_id, points_earned')
          .eq('tournament_id', tournament.id)
          .in('user_id', userIds)
          .in('match_id', matchIds)

        if (!journeyPredictions || journeyPredictions.length === 0) continue

        const userPoints = {}
        journeyPredictions.forEach(pred => {
          if (!userPoints[pred.user_id]) userPoints[pred.user_id] = 0
          userPoints[pred.user_id] += pred.points_earned || 0
        })

        const maxPoints = Math.max(...Object.values(userPoints))
        const usersWithMaxPoints = Object.values(userPoints).filter(pts => pts === maxPoints).length

        if (userPoints[user.id] === maxPoints) {
          console.log(`\nJournée ${matchday}:`)
          console.log(`  Matchs terminés: ${journeyMatches.length}`)
          console.log(`  Pronostics: ${journeyPredictions.length}`)
          console.log(`  Points par utilisateur:`)

          participants?.forEach(p => {
            const points = userPoints[p.user_id] || 0
            const isFirst = points === maxPoints
            console.log(`    ${p.profiles?.username}: ${points} points${isFirst ? ' 👑' : ''}`)
          })

          console.log(`  Max points: ${maxPoints}`)
          console.log(`  Nombre d'utilisateurs avec max points: ${usersWithMaxPoints}`)
          console.log(`  Rom's est premier: OUI`)
          console.log(`  Ancienne logique: TROPHÉE DONNÉ`)
          console.log(`  Nouvelle logique (maxPoints > 0 || usersWithMaxPoints === 1): ${maxPoints > 0 || usersWithMaxPoints === 1 ? 'TROPHÉE DONNÉ ✓' : 'TROPHÉE REFUSÉ ✗'}`)
        }
      }
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

debugKingSituation()
