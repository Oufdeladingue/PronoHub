require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBallonDorLogic() {
  try {
    console.log('=== TEST DE LA LOGIQUE "LE BALLON D\'OR" ===\n')

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
      .select('tournament_id')
      .eq('user_id', user.id)

    const tournamentIds = userTournaments?.map(t => t.tournament_id) || []

    // Récupérer les détails des tournois avec status='finished'
    const { data: finishedTournaments } = await supabase
      .from('tournaments')
      .select('id, name, status, starting_matchday, ending_matchday, competition_id')
      .in('id', tournamentIds)
      .eq('status', 'finished')

    console.log(`\nTournois terminés trouvés: ${finishedTournaments?.length || 0}\n`)

    if (!finishedTournaments || finishedTournaments.length === 0) {
      console.log('✗ Aucun tournoi terminé trouvé')
      console.log('  → Le trophée ne peut pas être débloqué\n')
      return
    }

    for (const tournament of finishedTournaments) {
      console.log(`\n--- Analyse du tournoi: ${tournament.name} ---`)
      console.log(`Status: ${tournament.status}`)
      console.log(`Journées: ${tournament.starting_matchday} → ${tournament.ending_matchday}`)

      // ÉTAPE 1: Vérifier que tous les matchs sont terminés
      console.log('\n1. Vérification de la complétude des matchs...')
      const { data: allTournamentMatches } = await supabase
        .from('imported_matches')
        .select('id, status, finished, home_score, away_score, matchday')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', tournament.starting_matchday)
        .lte('matchday', tournament.ending_matchday)

      console.log(`   Total matchs dans la plage: ${allTournamentMatches?.length || 0}`)

      const finishedMatches = allTournamentMatches?.filter(m =>
        (m.status === 'FINISHED' || m.finished === true) &&
        m.home_score !== null &&
        m.away_score !== null
      )

      const pendingMatches = allTournamentMatches?.filter(m =>
        (m.status !== 'FINISHED' && m.finished !== true) ||
        m.home_score === null ||
        m.away_score === null
      )

      console.log(`   Matchs terminés: ${finishedMatches?.length || 0}`)
      console.log(`   Matchs en attente: ${pendingMatches?.length || 0}`)

      const allMatchesComplete = allTournamentMatches?.every(m =>
        (m.status === 'FINISHED' || m.finished === true) &&
        m.home_score !== null &&
        m.away_score !== null
      )

      if (!allMatchesComplete) {
        console.log('   ✗ ÉCHEC: Tous les matchs ne sont pas terminés')
        console.log('   → Le trophée NE PEUT PAS être débloqué pour ce tournoi')
        continue
      }

      console.log('   ✓ SUCCÈS: Tous les matchs sont terminés')

      // ÉTAPE 2: Vérifier le classement final
      console.log('\n2. Vérification du classement final...')
      const { data: finalRanking } = await supabase
        .from('tournament_participants')
        .select('user_id, total_points, profiles(username)')
        .eq('tournament_id', tournament.id)
        .order('total_points', { ascending: false })
        .limit(5)

      console.log('   Top 5:')
      finalRanking?.forEach((p, idx) => {
        const isCurrentUser = p.user_id === user.id
        console.log(`     ${idx + 1}. ${p.profiles.username}: ${p.total_points} points${isCurrentUser ? ' ← MOI' : ''}`)
      })

      if (!finalRanking || finalRanking.length === 0 || finalRanking[0].user_id !== user.id) {
        console.log('   ✗ ÉCHEC: L\'utilisateur n\'est pas premier')
        console.log('   → Le trophée NE PEUT PAS être débloqué pour ce tournoi')
        continue
      }

      console.log('   ✓ L\'utilisateur est premier!')

      // ÉTAPE 3: Vérifier qu'il n'y a pas d'égalité
      if (finalRanking.length > 1 && finalRanking[0].total_points === finalRanking[1].total_points) {
        console.log('   ⚠️ ATTENTION: Égalité avec le 2ème!')
        console.log(`     ${finalRanking[0].profiles.username}: ${finalRanking[0].total_points} points`)
        console.log(`     ${finalRanking[1].profiles.username}: ${finalRanking[1].total_points} points`)
        console.log('   ✗ ÉCHEC: Pas de vainqueur unique')
        console.log('   → Le trophée NE PEUT PAS être débloqué (égalité)')
        continue
      }

      console.log('   ✓ Pas d\'égalité avec le 2ème')

      // ÉTAPE 4: Récupérer la date du dernier match
      console.log('\n3. Récupération de la date de déverrouillage...')
      const { data: lastMatches } = await supabase
        .from('imported_matches')
        .select('utc_date, matchday')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', tournament.ending_matchday)
        .order('utc_date', { ascending: false })
        .limit(1)

      const unlockDate = lastMatches?.[0]?.utc_date
      console.log(`   Date du dernier match: ${unlockDate}`)

      console.log('\n✅ RÉSULTAT FINAL: Le trophée "Ballon d\'or" DEVRAIT être débloqué!')
      console.log(`   Type: tournament_winner`)
      console.log(`   Date: ${unlockDate}`)
    }

    // Vérifier si le trophée existe déjà
    console.log('\n\n=== STATUT ACTUEL DU TROPHÉE ===')
    const { data: ballonDorTrophy } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'tournament_winner')
      .maybeSingle()

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

testBallonDorLogic()
