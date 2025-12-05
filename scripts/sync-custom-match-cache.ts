import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function syncCache() {
  console.log('Synchronisation du cache des matchs custom...')

  // Récupérer tous les matchs custom avec leur match importé associé
  const { data: customMatches, error: fetchError } = await supabase
    .from('custom_competition_matches')
    .select('id, imported_match_id')

  if (fetchError) {
    console.error('Erreur fetch:', fetchError)
    return
  }

  console.log('Matchs custom à synchroniser:', customMatches?.length)

  let updated = 0
  for (const cm of customMatches || []) {
    // Récupérer les infos du match importé
    const { data: importedMatch } = await supabase
      .from('imported_matches')
      .select('home_team, away_team, home_team_crest, away_team_crest, utc_date, competition_id')
      .eq('id', cm.imported_match_id)
      .single()

    if (!importedMatch) {
      console.log('Match importé non trouvé:', cm.imported_match_id)
      continue
    }

    // Récupérer le nom de la compétition
    const { data: competition } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', importedMatch.competition_id)
      .single()

    // Mettre à jour le cache
    const { error: updateError } = await supabase
      .from('custom_competition_matches')
      .update({
        cached_home_team: importedMatch.home_team,
        cached_away_team: importedMatch.away_team,
        cached_home_logo: importedMatch.home_team_crest,
        cached_away_logo: importedMatch.away_team_crest,
        cached_utc_date: importedMatch.utc_date,
        cached_competition_name: competition?.name || null
      })
      .eq('id', cm.id)

    if (updateError) {
      console.error('Erreur update pour', cm.id, ':', updateError)
    } else {
      updated++
    }
  }

  console.log(`Synchronisation terminée! ${updated}/${customMatches?.length} matchs mis à jour`)

  // Vérifier le résultat
  const { data: check } = await supabase
    .from('custom_competition_matches')
    .select('cached_home_team, cached_away_team, cached_utc_date')
    .limit(5)

  console.log('\nVérification (5 premiers matchs):')
  check?.forEach(m => {
    console.log(`  - ${m.cached_home_team} vs ${m.cached_away_team} (${m.cached_utc_date})`)
  })
}

syncCache()
