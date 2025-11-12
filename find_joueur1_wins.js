require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function findJoueur1Wins() {
  try {
    console.log('=== RECHERCHE DES VICTOIRES DE JOUEUR1 PAR JOURNÉE ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('Utilisateur:', user.username, '| ID:', user.id, '\n')

    // Récupérer tous les tournois
    const { data: userTournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id')
      .eq('user_id', user.id)

    console.log(`Tournois: ${userTournaments?.length || 0}\n`)

    for (const tp of userTournaments || []) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, starting_matchday, ending_matchday, competition_id')
        .eq('id', tp.tournament_id)
        .single()

      if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

      console.log(`\n=== ${tournament.name.toUpperCase()} ===`)
      console.log(`Journées: ${tournament.starting_matchday} → ${tournament.ending_matchday}\n`)

      // Pour chaque journée
      for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
        // Récupérer les matchs
        const { data: journeyMatches } = await supabase
          .from('imported_matches')
          .select('id, status, finished, home_score, away_score, utc_date')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', matchday)

        if (!journeyMatches || journeyMatches.length === 0) continue

        const allMatchesFinished = journeyMatches.every(m =>
          (m.status === 'FINISHED' || m.finished === true) &&
          m.home_score !== null &&
          m.away_score !== null
        )

        if (!allMatchesFinished) continue

        // Récupérer les participants
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('user_id')
          .eq('tournament_id', tournament.id)

        if (!participants || participants.length === 0) continue

        const userIds = participants.map(p => p.user_id)
        const matchIds = journeyMatches.map(m => m.id)

        // Récupérer les pronostics
        const { data: journeyPredictions } = await supabase
          .from('predictions')
          .select('user_id, points_earned, profiles(username)')
          .eq('tournament_id', tournament.id)
          .in('user_id', userIds)
          .in('match_id', matchIds)

        if (!journeyPredictions || journeyPredictions.length === 0) continue

        // Calculer les points
        const userPoints = {}
        journeyPredictions.forEach(pred => {
          if (!userPoints[pred.user_id]) {
            userPoints[pred.user_id] = {
              username: pred.profiles.username,
              points: 0
            }
          }
          userPoints[pred.user_id].points += pred.points_earned || 0
        })

        const maxPoints = Math.max(...Object.values(userPoints).map(u => u.points))

        if (userPoints[user.id] && userPoints[user.id].points === maxPoints) {
          const usersWithMaxPoints = Object.values(userPoints).filter(u => u.points === maxPoints).length

          const symbol = usersWithMaxPoints === 1 ? '👑' : '='
          const status = usersWithMaxPoints === 1 ? 'SEUL PREMIER' : `Égalité (${usersWithMaxPoints} joueurs)`

          console.log(`Journée ${matchday}: ${symbol} ${status} avec ${maxPoints} points`)

          if (usersWithMaxPoints > 1) {
            console.log(`  Classement:`)
            Object.entries(userPoints)
              .filter(([uid, data]) => data.points === maxPoints)
              .forEach(([uid, data]) => {
                const isHim = uid === user.id
                console.log(`    - ${data.username}: ${data.points} pts${isHim ? ' ← LUI' : ''}`)
              })
          }

          // Vérifier si le trophée devrait être débloqué selon la nouvelle logique
          const shouldUnlock = maxPoints > 0 || usersWithMaxPoints === 1

          if (shouldUnlock) {
            const latestMatch = journeyMatches.reduce((latest, match) => {
              if (!latest || match.utc_date > latest.utc_date) return match
              return latest
            }, null)

            console.log(`  ✅ DEVRAIT DÉBLOQUER "KING OF DAY" (date: ${latestMatch?.utc_date})`)
          }
        }
      }
    }

    console.log('\n\n=== TROPHÉE ACTUEL ===')
    const { data: kingOfDay } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'king_of_day')
      .maybeSingle()

    if (kingOfDay) {
      console.log('✓ Trophée "King of Day" débloqué le:', kingOfDay.unlocked_at)
    } else {
      console.log('✗ Trophée "King of Day" NON débloqué')
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

findJoueur1Wins()
