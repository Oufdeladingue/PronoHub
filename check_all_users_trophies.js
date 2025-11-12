require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAllUsersTrophies() {
  try {
    console.log('=== VÉRIFICATION COMPLÈTE DES TROPHÉES DE TOUS LES UTILISATEURS ===\n')

    // Récupérer tous les utilisateurs
    const { data: users } = await supabase
      .from('profiles')
      .select('id, username')
      .order('username')

    console.log(`Utilisateurs trouvés: ${users?.length || 0}\n`)

    for (const user of users || []) {
      console.log(`\n=== ${user.username.toUpperCase()} ===`)

      // Récupérer les trophées
      const { data: trophies } = await supabase
        .from('user_trophies')
        .select('trophy_type, unlocked_at')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false })

      console.log(`Trophées: ${trophies?.length || 0}`)

      if (trophies && trophies.length > 0) {
        trophies.forEach(t => {
          console.log(`  - ${t.trophy_type}: ${t.unlocked_at}`)
        })
      }

      // Vérifier spécifiquement les trophées problématiques
      const hasKingOfDay = trophies?.some(t => t.trophy_type === 'king_of_day')
      const hasDoubleKing = trophies?.some(t => t.trophy_type === 'double_king')
      const hasBallonDor = trophies?.some(t => t.trophy_type === 'tournament_winner')

      // Récupérer les tournois
      const { data: userTournaments } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)

      let hasValidKingOfDay = false
      let hasValidDoubleKing = false
      let hasValidBallonDor = false

      // Vérifier King of Day et Double King
      for (const tp of userTournaments || []) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('id, name, status, starting_matchday, ending_matchday, competition_id')
          .eq('id', tp.tournament_id)
          .single()

        if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

        // Vérifier Ballon d'or
        if (tournament.status === 'finished') {
          const { data: allMatches } = await supabase
            .from('imported_matches')
            .select('id, status, finished, home_score, away_score')
            .eq('competition_id', tournament.competition_id)
            .gte('matchday', tournament.starting_matchday)
            .lte('matchday', tournament.ending_matchday)

          const allMatchesComplete = allMatches?.every(m =>
            (m.status === 'FINISHED' || m.finished === true) &&
            m.home_score !== null &&
            m.away_score !== null
          )

          if (allMatchesComplete) {
            const { data: finalRanking } = await supabase
              .from('tournament_participants')
              .select('user_id, total_points')
              .eq('tournament_id', tournament.id)
              .order('total_points', { ascending: false })
              .limit(2)

            if (finalRanking && finalRanking.length > 0 && finalRanking[0].user_id === user.id) {
              const hasNoTie = !(finalRanking.length > 1 && finalRanking[0].total_points === finalRanking[1].total_points)
              if (hasNoTie) {
                hasValidBallonDor = true
              }
            }
          }
        }

        // Vérifier King of Day et Double King
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('user_id')
          .eq('tournament_id', tournament.id)

        if (!participants) continue

        const userIds = participants.map(p => p.user_id)
        let consecutiveWins = 0

        for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
          const { data: journeyMatches } = await supabase
            .from('imported_matches')
            .select('id, status, finished, home_score, away_score')
            .eq('competition_id', tournament.competition_id)
            .eq('matchday', matchday)

          if (!journeyMatches || journeyMatches.length === 0) {
            consecutiveWins = 0
            continue
          }

          const allMatchesFinished = journeyMatches.every(m =>
            (m.status === 'FINISHED' || m.finished === true) &&
            m.home_score !== null &&
            m.away_score !== null
          )

          if (!allMatchesFinished) {
            consecutiveWins = 0
            continue
          }

          const matchIds = journeyMatches.map(m => m.id)

          const { data: journeyPredictions } = await supabase
            .from('predictions')
            .select('user_id, points_earned')
            .eq('tournament_id', tournament.id)
            .in('user_id', userIds)
            .in('match_id', matchIds)

          if (!journeyPredictions || journeyPredictions.length === 0) {
            consecutiveWins = 0
            continue
          }

          const userPoints = {}
          journeyPredictions.forEach(pred => {
            if (!userPoints[pred.user_id]) userPoints[pred.user_id] = 0
            userPoints[pred.user_id] += pred.points_earned || 0
          })

          const maxPoints = Math.max(...Object.values(userPoints))
          const usersWithMaxPoints = Object.values(userPoints).filter(pts => pts === maxPoints).length

          if (userPoints[user.id] === maxPoints && (maxPoints > 0 || usersWithMaxPoints === 1)) {
            consecutiveWins++
            if (consecutiveWins >= 1) hasValidKingOfDay = true
            if (consecutiveWins >= 2) hasValidDoubleKing = true
          } else {
            consecutiveWins = 0
          }
        }
      }

      // Alertes
      const alerts = []
      if (hasKingOfDay && !hasValidKingOfDay) alerts.push('⚠️ "King of Day" invalide')
      if (hasDoubleKing && !hasValidDoubleKing) alerts.push('⚠️ "Roi du Doublé" invalide')
      if (hasBallonDor && !hasValidBallonDor) alerts.push('⚠️ "Ballon d\'or" invalide')

      if (alerts.length > 0) {
        console.log('\nALERTES:')
        alerts.forEach(a => console.log(`  ${a}`))
      } else if (trophies && trophies.length > 0) {
        console.log('\n✓ Tous les trophées sont valides')
      }
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

checkAllUsersTrophies()
