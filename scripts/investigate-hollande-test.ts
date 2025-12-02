import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function investigate() {
  console.log('=== Investigation du tournoi HollandeTest ===\n')

  // 1. Trouver le tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%hollande%')
    .single()

  if (tournamentError || !tournament) {
    console.log('Tournoi non trouvé:', tournamentError)
    return
  }

  console.log('Tournoi trouvé:')
  console.log('  - ID:', tournament.id)
  console.log('  - Nom:', tournament.name)
  console.log('  - Competition ID:', tournament.competition_id)
  console.log('  - Starting matchday:', tournament.starting_matchday)
  console.log('  - Ending matchday:', tournament.ending_matchday)
  console.log('')

  // 2. Récupérer les matchs de la compétition pour les journées du tournoi
  const { data: matches, error: matchesError } = await supabase
    .from('imported_matches')
    .select('id, matchday, utc_date, home_team_name, away_team_name, home_score, away_score, status, finished')
    .eq('competition_id', tournament.competition_id)
    .gte('matchday', tournament.starting_matchday)
    .lte('matchday', tournament.ending_matchday)
    .order('matchday', { ascending: true })
    .order('utc_date', { ascending: true })

  if (matchesError) {
    console.log('Erreur matchs:', matchesError)
    return
  }

  console.log(`Matchs trouvés: ${matches?.length || 0}`)

  // Grouper par journée
  const matchesByMatchday: Record<number, any[]> = {}
  matches?.forEach(m => {
    if (!matchesByMatchday[m.matchday]) {
      matchesByMatchday[m.matchday] = []
    }
    matchesByMatchday[m.matchday].push(m)
  })

  for (const [matchday, dayMatches] of Object.entries(matchesByMatchday)) {
    console.log(`\n--- Journée ${matchday} ---`)
    const finishedCount = dayMatches.filter(m => m.status === 'FINISHED' || m.finished).length
    const withScores = dayMatches.filter(m => m.home_score !== null).length
    console.log(`  Total: ${dayMatches.length}, Terminés: ${finishedCount}, Avec scores: ${withScores}`)

    // Afficher les premiers matchs
    dayMatches.slice(0, 3).forEach(m => {
      console.log(`  - ${m.home_team_name} vs ${m.away_team_name}: ${m.home_score ?? '?'}-${m.away_score ?? '?'} (status: ${m.status}, finished: ${m.finished})`)
    })
    if (dayMatches.length > 3) {
      console.log(`  ... et ${dayMatches.length - 3} autres matchs`)
    }
  }

  // 3. Récupérer les participants
  const { data: participants, error: participantsError } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  if (participantsError) {
    console.log('Erreur participants:', participantsError)
    return
  }

  console.log(`\n=== Participants (${participants?.length || 0}) ===`)

  // 4. Pour chaque participant, vérifier ses pronostics et points
  for (const participant of participants || []) {
    const username = (participant.profiles as any)?.username || 'Unknown'

    // Récupérer les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction')
      .eq('tournament_id', tournament.id)
      .eq('user_id', participant.user_id)

    console.log(`\n${username}:`)
    console.log(`  - Pronostics en base: ${predictions?.length || 0}`)

    // Vérifier si des pronostics sont des défauts
    const defaultPreds = predictions?.filter(p => p.is_default_prediction) || []
    console.log(`  - Pronostics par défaut: ${defaultPreds.length}`)

    // Calculer les points manuellement
    let totalPoints = 0
    let matchesWithPoints = 0

    const matchIds = predictions?.map(p => p.match_id) || []
    if (matchIds.length > 0) {
      const { data: matchesWithScores } = await supabase
        .from('imported_matches')
        .select('id, home_score, away_score, status, finished')
        .in('id', matchIds)
        .not('home_score', 'is', null)

      for (const pred of predictions || []) {
        const match = matchesWithScores?.find(m => m.id === pred.match_id)
        if (!match || match.home_score === null) continue

        matchesWithPoints++

        const isExact = pred.predicted_home_score === match.home_score &&
                       pred.predicted_away_score === match.away_score
        const predOutcome = pred.predicted_home_score > pred.predicted_away_score ? 'H' :
                          (pred.predicted_home_score < pred.predicted_away_score ? 'A' : 'D')
        const realOutcome = match.home_score > match.away_score ? 'H' :
                          (match.home_score < match.away_score ? 'A' : 'D')
        const isCorrect = predOutcome === realOutcome

        let points = 0
        if (pred.is_default_prediction && realOutcome === 'D') {
          points = 1
        } else if (pred.is_default_prediction) {
          points = 0
        } else if (isExact) {
          points = 3
        } else if (isCorrect) {
          points = 1
        }

        if (points > 0) {
          console.log(`    Match ${pred.match_id}: prévu ${pred.predicted_home_score}-${pred.predicted_away_score}, réel ${match.home_score}-${match.away_score} => ${points} pts ${pred.is_default_prediction ? '(défaut)' : ''}`)
        }

        totalPoints += points
      }
    }

    console.log(`  - Points calculés: ${totalPoints} (sur ${matchesWithPoints} matchs avec scores)`)
  }
}

investigate().catch(console.error)
