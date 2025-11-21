require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findSoloKing() {
  try {
    console.log('=== RECHERCHE DE LA SITUATION "SEUL AVEC 0 POINTS" ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '\n')

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

      // Récupérer tous les participants
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id, profiles(username)')
        .eq('tournament_id', tournament.id)

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
          .select('user_id, points_earned, profiles(username)')
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

        // CHERCHER: Rom's seul avec maxPoints (peu importe la valeur)
        if (userPoints[user.id] === maxPoints && usersWithMaxPoints === 1) {
          console.log(`\n=== TROUVÉ: ${tournament.name} - Journée ${matchday} ===`)
          console.log(`Participants au tournoi: ${participants?.length}`)
          participants?.forEach(p => console.log(`  - ${p.profiles?.username}`))

          console.log(`\nPronostics sur cette journée:`)
          const uniqueUsers = [...new Set(journeyPredictions.map(p => p.user_id))]
          console.log(`  Nombre d'utilisateurs ayant pronostiqué: ${uniqueUsers.length}`)

          uniqueUsers.forEach(uid => {
            const preds = journeyPredictions.filter(p => p.user_id === uid)
            const username = preds[0]?.profiles?.username
            console.log(`  - ${username}: ${preds.length} pronostics`)
          })

          console.log(`\nPoints:`)
          Object.entries(userPoints).forEach(([uid, points]) => {
            const pred = journeyPredictions.find(p => p.user_id === uid)
            const username = pred?.profiles?.username || 'Inconnu'
            console.log(`  ${username}: ${points} points${uid === user.id ? ' 👑 (ROM\'S - SEUL!)' : ''}`)
          })

          console.log(`\nRaison du trophée:`)
          console.log(`  maxPoints = ${maxPoints}`)
          console.log(`  usersWithMaxPoints = ${usersWithMaxPoints}`)
          console.log(`  Condition (maxPoints > 0 || usersWithMaxPoints === 1): ${maxPoints > 0 || usersWithMaxPoints === 1}`)

          if (maxPoints === 0) {
            console.log(`\n⚠️ PROBLÈME: Rom's est seul avec 0 points`)
            console.log(`  Cela signifie qu'il est le SEUL à avoir pronostiqué sur cette journée`)
            console.log(`  Ou que les autres n'ont pas de pronostics comptabilisés`)
          }
        }
      }
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

findSoloKing()
