require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkOpportunistTrophy() {
  try {
    // 1. Trouver l'utilisateur Rom's
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    if (userError || !user) {
      console.error('Utilisateur Rom\'s non trouvé:', userError)
      return
    }

    console.log('Utilisateur trouvé:', user.username, 'ID:', user.id)

    // 2. Trouver le tournoi BrazilTest
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, competition_id')
      .ilike('name', '%BrazilTest%')
      .single()

    if (tournamentError || !tournament) {
      console.error('Tournoi BrazilTest non trouvé:', tournamentError)
      return
    }

    console.log('Tournoi trouvé:', tournament.name, 'ID:', tournament.id)

    // 3. Récupérer tous les pronostics de l'utilisateur pour ce tournoi
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, match_id, tournament_id')
      .eq('user_id', user.id)
      .eq('tournament_id', tournament.id)

    console.log(`\nPronostics trouvés: ${predictions?.length || 0}`)

    if (!predictions || predictions.length === 0) {
      console.log('Aucun pronostic trouvé')
      return
    }

    // 4. Récupérer les matchs correspondants
    const matchIds = predictions.map(p => p.match_id).filter(Boolean)
    console.log(`\nRecherche de ${matchIds.length} matchs...`)
    console.log(`Exemples d'IDs: ${matchIds.slice(0, 3).join(', ')}`)

    const { data: matches, error: matchError } = await supabase
      .from('imported_matches')
      .select('id, home_score, away_score, status, finished, matchday, utc_date, home_team_id, away_team_id')
      .in('id', matchIds)

    if (matchError) console.error('Erreur lors de la récupération des matchs:', matchError)
    console.log(`Matchs trouvés: ${matches?.length || 0}`)

    if (!matches || matches.length === 0) {
      console.log('Aucun match trouvé')
      return
    }

    // 5. Récupérer les noms des équipes
    const teamIds = [...new Set([
      ...matches.map(m => m.home_team_id),
      ...matches.map(m => m.away_team_id)
    ].filter(Boolean))]

    const { data: teams } = await supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds)

    const teamsMap = {}
    teams?.forEach(team => {
      teamsMap[team.id] = team.name
    })

    // 6. Créer une map des matchs
    const matchesMap = {}
    matches.forEach(match => {
      matchesMap[match.id] = {
        ...match,
        home_team_name: teamsMap[match.home_team_id] || 'N/A',
        away_team_name: teamsMap[match.away_team_id] || 'N/A'
      }
    })

    // 7. Grouper les pronostics par journée
    const predictionsByMatchday = {}

    for (const pred of predictions) {
      const match = matchesMap[pred.match_id]
      if (!match || (match.status !== 'FINISHED' && match.finished !== true)) continue
      if (match.home_score === null || match.away_score === null) continue

      const matchday = match.matchday
      if (!predictionsByMatchday[matchday]) {
        predictionsByMatchday[matchday] = []
      }

      const predResult = pred.predicted_home_score > pred.predicted_away_score ? 'HOME' :
                        pred.predicted_home_score < pred.predicted_away_score ? 'AWAY' : 'DRAW'
      const actualResult = match.home_score > match.away_score ? 'HOME' :
                          match.home_score < match.away_score ? 'AWAY' : 'DRAW'
      const isCorrect = predResult === actualResult

      predictionsByMatchday[matchday].push({
        match_id: match.id,
        matchday: matchday,
        home_team: match.home_team_name,
        away_team: match.away_team_name,
        predicted: `${pred.predicted_home_score}-${pred.predicted_away_score}`,
        actual: `${match.home_score}-${match.away_score}`,
        pred_result: predResult,
        actual_result: actualResult,
        is_correct: isCorrect,
        utc_date: match.utc_date
      })
    }

    // 8. Analyser chaque journée
    console.log('\n=== ANALYSE PAR JOURNÉE ===\n')

    const sortedMatchdays = Object.keys(predictionsByMatchday).sort((a, b) => parseInt(a) - parseInt(b))

    for (const matchday of sortedMatchdays) {
      const preds = predictionsByMatchday[matchday]
      const correctResults = preds.filter(p => p.is_correct).length

      console.log(`Journée ${matchday}: ${correctResults} bons résultats sur ${preds.length} pronostics`)

      if (parseInt(matchday) === 32 || correctResults >= 2) {
        console.log('  Détails:')
        preds.forEach(p => {
          console.log(`    ${p.home_team} vs ${p.away_team}`)
          console.log(`      Prédit: ${p.predicted} (${p.pred_result}) | Résultat: ${p.actual} (${p.actual_result}) | ${p.is_correct ? '✓' : '✗'}`)
          console.log(`      Date: ${p.utc_date}`)
        })
        console.log('')
      }
    }

    // 8. Vérifier si le trophée opportuniste existe
    const { data: trophy, error: trophyError } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'opportunist')
      .maybeSingle()

    console.log('\n=== STATUT DU TROPHÉE OPPORTUNISTE ===')
    if (trophy) {
      console.log('✓ Trophée déjà obtenu le:', trophy.unlocked_at)
      console.log('  Is new:', trophy.is_new)
    } else {
      console.log('✗ Trophée non obtenu')
    }

    // 9. Vérifier tous les trophées de l'utilisateur
    const { data: allTrophies } = await supabase
      .from('user_trophies')
      .select('trophy_type, unlocked_at, is_new')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    console.log('\n=== TOUS LES TROPHÉES DE L\'UTILISATEUR ===')
    if (allTrophies && allTrophies.length > 0) {
      allTrophies.forEach(t => {
        console.log(`- ${t.trophy_type}: ${t.unlocked_at} ${t.is_new ? '(nouveau)' : ''}`)
      })
    } else {
      console.log('Aucun trophée')
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

checkOpportunistTrophy()
