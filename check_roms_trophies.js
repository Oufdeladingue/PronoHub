require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRomsTrophies() {
  try {
    console.log('=== ANALYSE COMPLÈTE DES TROPHÉES DE ROM\'S ===\n')

    // Trouver Rom's
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '| ID:', user.id, '\n')

    // Récupérer tous les trophées actuels
    const { data: currentTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    console.log('TROPHÉES ACTUELS:', currentTrophies?.length || 0)
    currentTrophies?.forEach(t => {
      console.log(`  - ${t.trophy_type}: ${t.unlocked_at}`)
    })

    // Récupérer tous les tournois
    const { data: userTournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id, total_points')
      .eq('user_id', user.id)

    console.log(`\n\nTOURNOIS: ${userTournaments?.length || 0}\n`)

    for (const tp of userTournaments || []) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, starting_matchday, ending_matchday, competition_id')
        .eq('id', tp.tournament_id)
        .single()

      if (!tournament || !tournament.starting_matchday || !tournament.ending_matchday) continue

      console.log(`\n=== ${tournament.name.toUpperCase()} ===`)
      console.log(`Journées: ${tournament.starting_matchday} → ${tournament.ending_matchday}`)
      console.log(`Points totaux: ${tp.total_points}\n`)

      // Récupérer les participants
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id, profiles(username)')
        .eq('tournament_id', tournament.id)

      const userIds = participants.map(p => p.user_id)

      let consecutiveWins = 0
      let maxConsecutive = 0
      let firstWinMatchday = null

      // Analyser chaque journée
      for (let matchday = tournament.starting_matchday; matchday <= tournament.ending_matchday; matchday++) {
        // Récupérer les matchs
        const { data: journeyMatches } = await supabase
          .from('imported_matches')
          .select('id, status, finished, home_score, away_score, utc_date')
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

        // Récupérer les pronostics
        const { data: journeyPredictions } = await supabase
          .from('predictions')
          .select('user_id, points_earned, profiles(username)')
          .eq('tournament_id', tournament.id)
          .in('user_id', userIds)
          .in('match_id', matchIds)

        if (!journeyPredictions || journeyPredictions.length === 0) {
          consecutiveWins = 0
          continue
        }

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
        const usersWithMaxPoints = Object.values(userPoints).filter(u => u.points === maxPoints).length

        const romsPoints = userPoints[user.id]?.points || 0
        const isFirst = romsPoints === maxPoints

        // Déterminer si Rom's devrait gagner cette journée selon la nouvelle logique
        const shouldWin = isFirst && (maxPoints > 0 || usersWithMaxPoints === 1)

        if (shouldWin) {
          consecutiveWins++
          if (consecutiveWins > maxConsecutive) {
            maxConsecutive = consecutiveWins
          }
          if (consecutiveWins === 1) {
            firstWinMatchday = matchday
          }
        } else {
          consecutiveWins = 0
        }

        const symbol = shouldWin ? '👑' : (isFirst ? '=' : ' ')
        const status = shouldWin ? 'PREMIER' : (isFirst ? `Égalité (${usersWithMaxPoints})` : '')

        console.log(`Journée ${matchday}: ${symbol} ${status} ${romsPoints}/${maxPoints} pts (consécutives: ${consecutiveWins})`)

        // Afficher le classement si Rom's est premier
        if (isFirst) {
          const sorted = Object.entries(userPoints)
            .sort((a, b) => b[1].points - a[1].points)

          console.log(`  Classement:`)
          sorted.slice(0, 3).forEach(([uid, data]) => {
            const isHim = uid === user.id
            console.log(`    - ${data.username}: ${data.points} pts${isHim ? ' ← LUI' : ''}`)
          })
        }
      }

      console.log(`\nRésumé pour ${tournament.name}:`)
      console.log(`  Victoires consécutives max: ${maxConsecutive}`)
      console.log(`  Première victoire: Journée ${firstWinMatchday || 'aucune'}`)
      console.log(`  Devrait avoir "King of Day": ${maxConsecutive >= 1 ? 'OUI' : 'NON'}`)
      console.log(`  Devrait avoir "Roi du Doublé": ${maxConsecutive >= 2 ? 'OUI' : 'NON'}`)
    }

    // Vérifier les trophées spécifiques
    console.log('\n\n=== VÉRIFICATION DES TROPHÉES ===\n')

    const kingOfDay = currentTrophies?.find(t => t.trophy_type === 'king_of_day')
    console.log('1. "King of Day":')
    if (kingOfDay) {
      console.log(`   ⚠️ DÉBLOQUÉ le ${kingOfDay.unlocked_at}`)
      console.log(`   → Vérifier si justifié`)
    } else {
      console.log(`   ✓ NON débloqué`)
    }

    const doubleKing = currentTrophies?.find(t => t.trophy_type === 'double_king')
    console.log('\n2. "Roi du Doublé":')
    if (doubleKing) {
      console.log(`   ⚠️ DÉBLOQUÉ le ${doubleKing.unlocked_at}`)
      console.log(`   → Vérifier si justifié`)
    } else {
      console.log(`   ✓ NON débloqué`)
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

checkRomsTrophies()
