require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkJoueur1Trophies() {
  try {
    // 1. Trouver l'utilisateur Joueur1
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    if (userError || !user) {
      console.error('Utilisateur joueur1 non trouvé:', userError)
      return
    }

    console.log('=== ANALYSE DES TROPHÉES DE', user.username.toUpperCase(), '===')
    console.log('ID:', user.id, '\n')

    // 2. Vérifier les trophées actuels
    const { data: currentTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    console.log('TROPHÉES ACTUELS:', currentTrophies?.length || 0)
    currentTrophies?.forEach(t => {
      console.log(`  - ${t.trophy_type}: ${t.unlocked_at} ${t.is_new ? '(nouveau)' : ''}`)
    })

    // 3. Vérifier le trophée "Ballon d'or" (tournament_winner)
    const ballonDor = currentTrophies?.find(t => t.trophy_type === 'tournament_winner')

    console.log('\n\n=== VÉRIFICATION "BALLON D\'OR" ===')
    if (ballonDor) {
      console.log('⚠️ TROPHÉE DÉBLOQUÉ le:', ballonDor.unlocked_at)
      console.log('   Vérifions si cela est justifié...\n')
    } else {
      console.log('✓ Trophée NON débloqué (correct)\n')
    }

    // Récupérer tous les tournois de l'utilisateur
    const { data: userTournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id, total_points')
      .eq('user_id', user.id)

    console.log(`Tournois de l'utilisateur: ${userTournaments?.length || 0}`)

    for (const tp of userTournaments || []) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, status, starting_matchday, ending_matchday, competition_id')
        .eq('id', tp.tournament_id)
        .single()

      console.log(`\n  Tournoi: ${tournament.name}`)
      console.log(`    Status: ${tournament.status}`)
      console.log(`    Points totaux: ${tp.total_points}`)
      console.log(`    Journées: ${tournament.starting_matchday} → ${tournament.ending_matchday}`)

      // Classement du tournoi
      const { data: ranking } = await supabase
        .from('tournament_participants')
        .select('user_id, total_points, profiles(username)')
        .eq('tournament_id', tournament.id)
        .order('total_points', { ascending: false })

      console.log(`    Classement:`)
      ranking?.forEach((p, idx) => {
        const isCurrentUser = p.user_id === user.id
        console.log(`      ${idx + 1}. ${p.profiles.username}: ${p.total_points} points${isCurrentUser ? ' ← LUI' : ''}`)
      })

      if (tournament.status === 'finished') {
        console.log('    ⚠️ TOURNOI MARQUÉ COMME TERMINÉ')

        // Vérifier si tous les matchs sont vraiment terminés
        const { data: allMatches } = await supabase
          .from('imported_matches')
          .select('id, status, finished, home_score, away_score, matchday')
          .eq('competition_id', tournament.competition_id)
          .gte('matchday', tournament.starting_matchday)
          .lte('matchday', tournament.ending_matchday)

        const finishedMatches = allMatches?.filter(m =>
          (m.status === 'FINISHED' || m.finished === true) &&
          m.home_score !== null &&
          m.away_score !== null
        )

        console.log(`    Matchs terminés: ${finishedMatches?.length || 0} / ${allMatches?.length || 0}`)

        if (finishedMatches?.length !== allMatches?.length) {
          console.log('    ⚠️ PROBLÈME: Tournoi marqué "finished" mais tous les matchs ne sont pas terminés!')
        }

        if (ranking && ranking[0].user_id === user.id) {
          console.log('    → L\'utilisateur EST premier, le trophée DEVRAIT être débloqué')
        } else {
          console.log('    → L\'utilisateur N\'EST PAS premier, le trophée NE DEVRAIT PAS être débloqué')
        }
      }
    }

    // 4. Vérifier le trophée "King of Day"
    console.log('\n\n=== VÉRIFICATION "KING OF DAY" ===')

    const kingOfDay = currentTrophies?.find(t => t.trophy_type === 'king_of_day')

    if (kingOfDay) {
      console.log('✓ TROPHÉE DÉBLOQUÉ le:', kingOfDay.unlocked_at)
    } else {
      console.log('⚠️ TROPHÉE NON DÉBLOQUÉ')
      console.log('   Vérifions si l\'utilisateur devrait l\'avoir...\n')
    }

    // Récupérer tous les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('user_id, points_earned, match_id, tournament_id')
      .eq('user_id', user.id)

    console.log(`Pronostics de l'utilisateur: ${predictions?.length || 0}`)

    if (predictions && predictions.length > 0 && userTournaments && userTournaments.length > 0) {
      console.log('\nAnalyse par tournoi et journée...\n')

      for (const tp of userTournaments) {
        const { data: tournament } = await supabase
          .from('tournaments')
          .select('id, name, starting_matchday, ending_matchday, competition_id')
          .eq('id', tp.tournament_id)
          .single()

        if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

        console.log(`Tournoi: ${tournament.name}`)

        // Pour chaque journée
        for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
          // Récupérer les matchs de cette journée
          const { data: journeyMatches } = await supabase
            .from('imported_matches')
            .select('id, status, finished, home_score, away_score')
            .eq('competition_id', tournament.competition_id)
            .eq('matchday', matchday)

          if (!journeyMatches || journeyMatches.length === 0) continue

          // Vérifier si tous les matchs sont terminés
          const allMatchesFinished = journeyMatches.every(m =>
            (m.status === 'FINISHED' || m.finished === true) &&
            m.home_score !== null &&
            m.away_score !== null
          )

          if (!allMatchesFinished) continue

          // Récupérer tous les participants du tournoi
          const { data: participants } = await supabase
            .from('tournament_participants')
            .select('user_id')
            .eq('tournament_id', tournament.id)

          if (!participants || participants.length === 0) continue

          const userIds = participants.map(p => p.user_id)
          const matchIds = journeyMatches.map(m => m.id)

          // Récupérer les pronostics de tous les utilisateurs pour cette journée
          const { data: journeyPredictions } = await supabase
            .from('predictions')
            .select('user_id, points_earned, profiles(username)')
            .eq('tournament_id', tournament.id)
            .in('user_id', userIds)
            .in('match_id', matchIds)

          if (!journeyPredictions || journeyPredictions.length === 0) continue

          // Calculer les points par utilisateur
          const userPoints = {}
          journeyPredictions.forEach(pred => {
            if (!userPoints[pred.user_id]) {
              userPoints[pred.user_id] = {
                username: pred.profiles?.username || 'Unknown',
                points: 0
              }
            }
            userPoints[pred.user_id].points += pred.points_earned || 0
          })

          const maxPoints = Math.max(...Object.values(userPoints).map(u => u.points))
          const winners = Object.entries(userPoints).filter(([uid, data]) => data.points === maxPoints)

          if (maxPoints > 0) {
            const isWinner = winners.some(([uid]) => uid === user.id)

            if (isWinner || winners.length === 1) {
              const status = isWinner ? '👑 PREMIER' : '   '
              console.log(`  Journée ${matchday}: ${status} ${userPoints[user.id]?.points || 0} pts (max: ${maxPoints} pts)`)

              if (isWinner) {
                console.log(`    ✓ L'utilisateur DEVRAIT avoir le trophée "King of Day"!`)
                console.log(`    Classement de cette journée:`)
                Object.entries(userPoints)
                  .sort((a, b) => b[1].points - a[1].points)
                  .slice(0, 5)
                  .forEach(([uid, data], idx) => {
                    const isHim = uid === user.id
                    console.log(`      ${idx + 1}. ${data.username}: ${data.points} pts${isHim ? ' ← LUI' : ''}`)
                  })
              }
            }
          }
        }
        console.log('')
      }
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

checkJoueur1Trophies()
