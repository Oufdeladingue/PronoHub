require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkBallonDorTrophy() {
  try {
    // Trouver l'utilisateur Rom's
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '| ID:', user.id)

    // Récupérer tous les tournois de l'utilisateur
    const { data: userTournaments } = await supabase
      .from('tournament_participants')
      .select('tournament_id, total_points, tournaments(id, name, status, starting_matchday, ending_matchday, competition_id)')
      .eq('user_id', user.id)

    console.log(`\n=== TOUS LES TOURNOIS DE L'UTILISATEUR (${userTournaments?.length || 0}) ===\n`)

    for (const tp of userTournaments || []) {
      const tournament = tp.tournaments
      console.log(`Tournoi: ${tournament.name}`)
      console.log(`  Status: ${tournament.status}`)
      console.log(`  Points totaux: ${tp.total_points}`)
      console.log(`  Journées: ${tournament.starting_matchday} → ${tournament.ending_matchday}`)

      // Récupérer tous les participants du tournoi
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('user_id, total_points, profiles(username)')
        .eq('tournament_id', tournament.id)
        .order('total_points', { ascending: false })

      console.log(`  Classement:`)
      allParticipants?.forEach((p, idx) => {
        const isCurrentUser = p.user_id === user.id
        console.log(`    ${idx + 1}. ${p.profiles.username}: ${p.total_points} points${isCurrentUser ? ' ← MOI' : ''}`)
      })

      // Si status = 'finished', vérifier si tous les matchs sont vraiment terminés
      if (tournament.status === 'finished') {
        console.log(`  ⚠️ Tournoi marqué comme TERMINÉ`)

        // Récupérer tous les matchs du tournoi
        const { data: allMatches } = await supabase
          .from('imported_matches')
          .select('id, status, finished, home_score, away_score, matchday')
          .eq('competition_id', tournament.competition_id)
          .gte('matchday', tournament.starting_matchday)
          .lte('matchday', tournament.ending_matchday)

        console.log(`  Total matchs dans la plage: ${allMatches?.length || 0}`)

        const finishedMatches = allMatches?.filter(m =>
          (m.status === 'FINISHED' || m.finished === true) &&
          m.home_score !== null &&
          m.away_score !== null
        )

        const pendingMatches = allMatches?.filter(m =>
          (m.status !== 'FINISHED' && m.finished !== true) ||
          m.home_score === null ||
          m.away_score === null
        )

        console.log(`  Matchs terminés: ${finishedMatches?.length || 0}`)
        console.log(`  Matchs en attente: ${pendingMatches?.length || 0}`)

        if (pendingMatches && pendingMatches.length > 0) {
          console.log(`  ⚠️ ATTENTION: Le tournoi est marqué "finished" mais ${pendingMatches.length} matchs ne sont pas terminés!`)
          console.log(`  Journées concernées:`, [...new Set(pendingMatches.map(m => m.matchday))].sort().join(', '))
        }

        // Vérifier si l'utilisateur est premier
        if (allParticipants && allParticipants[0].user_id === user.id) {
          console.log(`  ✓ L'utilisateur EST premier au classement final!`)
          console.log(`  → Le trophée "Ballon d'or" DEVRAIT être débloqué`)

          // Récupérer la date du dernier match
          const { data: lastMatches } = await supabase
            .from('imported_matches')
            .select('utc_date, matchday')
            .eq('competition_id', tournament.competition_id)
            .eq('matchday', tournament.ending_matchday)
            .order('utc_date', { ascending: false })
            .limit(1)

          if (lastMatches && lastMatches.length > 0) {
            console.log(`  Date de déverrouillage: ${lastMatches[0].utc_date}`)
          }
        } else {
          console.log(`  ✗ L'utilisateur n'est PAS premier au classement final`)
        }
      }

      console.log('')
    }

    // Vérifier si le trophée "Ballon d'or" existe
    const { data: ballonDorTrophy } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'tournament_winner')
      .maybeSingle()

    console.log('\n=== STATUT DU TROPHÉE "BALLON D\'OR" ===')
    if (ballonDorTrophy) {
      console.log('✓ Trophée obtenu le:', ballonDorTrophy.unlocked_at)
      console.log('  Is new:', ballonDorTrophy.is_new)
    } else {
      console.log('✗ Trophée non obtenu')
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

checkBallonDorTrophy()
