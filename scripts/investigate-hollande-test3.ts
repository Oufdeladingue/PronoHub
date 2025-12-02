import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function investigate() {
  // Les IDs de pronostics de Rom's
  const predMatchIds = [
    '1766305f-5936-4958-bdfa-af466b9e63ce',
    'ed4a2da1-118b-46e3-b585-082432bd88cf',
    'dcbe63fc-c1f4-48e0-a3a7-29dfa446d253',
    'a660f421-f3d4-4056-8f8d-dc76a36e9aef',
    '93e08b14-1cdf-401c-89d7-65b9bf6f7702',
    '7b744078-e186-4032-bb50-f4d865de84f8',
    '231a044b-803d-4de8-8675-a55dd96f8934',
    '388dbfa2-5bd6-4e8a-ae16-34ade0bd6c89',
    '72ba2f46-04ce-417d-a8b7-b82c087f5ab7'
  ]

  console.log('=== Recherche des matchs par ID ===\n')

  // Chercher ces IDs dans imported_matches (avec cast car match_id est text dans predictions mais number dans imported_matches)
  for (const matchId of predMatchIds) {
    const { data: match, error } = await supabase
      .from('imported_matches')
      .select('id, matchday, home_team_name, away_team_name, home_score, away_score')
      .eq('id', matchId)
      .single()

    if (match) {
      console.log(`✓ ${matchId}: ${match.home_team_name} vs ${match.away_team_name} (J${match.matchday})`)
    } else {
      console.log(`✗ ${matchId}: NON TROUVÉ`)
    }
  }

  // Regarder le type de la colonne ID dans imported_matches
  console.log('\n=== Vérification du type de ID ===')
  const { data: sample } = await supabase
    .from('imported_matches')
    .select('id')
    .limit(1)

  console.log('Sample ID:', sample?.[0]?.id, 'Type:', typeof sample?.[0]?.id)

  // Les IDs des predictions sont peut-être des INT et pas des UUID?
  console.log('\n=== Vérification des predictions ===')
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('name', '%hollande%')
    .single()

  const { data: preds } = await supabase
    .from('predictions')
    .select('match_id')
    .eq('tournament_id', tournament?.id)
    .limit(1)

  console.log('Sample prediction match_id:', preds?.[0]?.match_id, 'Type:', typeof preds?.[0]?.match_id)

  // Essayons de trouver des matchs avec ID numérique
  console.log('\n=== Recherche par ID numérique ===')
  const { data: matchByNumber } = await supabase
    .from('imported_matches')
    .select('id, matchday, home_team_name, away_team_name')
    .eq('competition_id', 2003)
    .eq('matchday', 13)
    .limit(3)

  matchByNumber?.forEach(m => {
    console.log(`ID: ${m.id} (type: ${typeof m.id}) - ${m.home_team_name} vs ${m.away_team_name}`)
  })
}

investigate().catch(console.error)
