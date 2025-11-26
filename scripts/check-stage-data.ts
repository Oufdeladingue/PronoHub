import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkStageData() {
  console.log('🔍 Vérification des matchs Champions League...\n')

  const { data, error } = await supabase
    .from('imported_matches')
    .select('id, matchday, stage, home_team_name, away_team_name')
    .eq('competition_id', 2001)
    .order('matchday', { ascending: true })
    .limit(15)

  if (error) {
    console.error('❌ Erreur:', error)
  } else if (data) {
    console.log('Exemples de matchs (Champions League):')
    console.table(data)

    const withStage = data.filter(m => m.stage !== null && m.stage !== '')
    console.log(`\n📊 ${withStage.length}/${data.length} matchs ont un stage renseigné`)

    if (withStage.length === 0) {
      console.log('\n⚠️  PROBLÈME: Aucun match n\'a de stage renseigné!')
      console.log('Cela signifie que l\'API Football-Data ne renvoie pas le champ "stage"')
    }
  }
}

checkStageData()
