require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugMatches() {
  try {
    // 1. Trouver l'utilisateur Rom's
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, 'ID:', user.id)

    // 2. Trouver le tournoi BrazilTest
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, competition_id')
      .ilike('name', '%BrazilTest%')
      .single()

    console.log('Tournoi:', tournament.name, 'ID:', tournament.id, 'Competition ID:', tournament.competition_id)

    // 3. Récupérer les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, predicted_home_score, predicted_away_score, match_id, tournament_id')
      .eq('user_id', user.id)
      .eq('tournament_id', tournament.id)
      .limit(5)

    console.log('\nExemples de pronostics:')
    predictions.forEach(p => {
      console.log(`  Match ID: ${p.match_id} | Prédit: ${p.predicted_home_score}-${p.predicted_away_score}`)
    })

    const matchIds = predictions.map(p => p.match_id)

    // 4. Essayer de trouver ces matchs dans imported_matches
    console.log('\nRecherche dans imported_matches...')
    const { data: matches1, error: error1 } = await supabase
      .from('imported_matches')
      .select('id, home_team, away_team, matchday')
      .in('id', matchIds)

    console.log(`Résultat avec .in('id', matchIds): ${matches1?.length || 0} matchs`)
    if (error1) console.error('Erreur:', error1)

    // 5. Vérifier s'il y a des matchs pour cette compétition
    const { data: competitionMatches, error: compError } = await supabase
      .from('imported_matches')
      .select('id, matchday, competition_id')
      .eq('competition_id', tournament.competition_id)
      .limit(5)

    console.log(`\nMatchs dans la compétition ${tournament.competition_id}:`)
    if (competitionMatches && competitionMatches.length > 0) {
      competitionMatches.forEach(m => {
        console.log(`  ID: ${m.id} | Journée ${m.matchday}`)
      })
    } else {
      console.log('  Aucun match trouvé pour cette compétition')
      if (compError) console.error('  Erreur:', compError)
    }

    // 6. Vérifier le type de match_id dans predictions
    console.log('\nType de match_id dans predictions:', typeof matchIds[0])
    console.log('Valeur de match_id[0]:', matchIds[0])

    // 7. Essayer de chercher un match par son ID directement
    if (matchIds.length > 0) {
      const { data: directMatch, error: directError } = await supabase
        .from('imported_matches')
        .select('id, matchday, competition_id, home_score, away_score, status')
        .eq('id', matchIds[0])
        .maybeSingle()

      console.log(`\nRecherche directe du match ${matchIds[0]}:`)
      if (directMatch) {
        console.log('  Trouvé! Journée:', directMatch.matchday, '| Compétition:', directMatch.competition_id, '| Score:', directMatch.home_score, '-', directMatch.away_score, '| Status:', directMatch.status)
      } else {
        console.log('  Non trouvé')
        if (directError) console.error('  Erreur:', directError)
      }
    }

    // 8. Vérifier le nombre total de matchs dans imported_matches
    const { count } = await supabase
      .from('imported_matches')
      .select('*', { count: 'exact', head: true })

    console.log(`\nNombre total de matchs dans imported_matches: ${count}`)

  } catch (error) {
    console.error('Erreur:', error)
  }
}

debugMatches()
