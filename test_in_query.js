require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testInQuery() {
  const matchIds = [
    'df9f2f28-60ab-419d-bd76-86a4a76bc221',
    '56be0a55-e2ed-4924-99f9-2de75e1db72b',
    '08798f37-a0c2-4fa2-9346-735ccca3928b'
  ]

  console.log('Test 1: Simple .in() query')
  const { data: test1, error: error1 } = await supabase
    .from('imported_matches')
    .select('id, matchday')
    .in('id', matchIds)

  console.log('Résultat:', test1?.length || 0, 'matchs')
  if (error1) console.error('Erreur:', error1)

  console.log('\nTest 2: .in() avec join vers teams')
  const { data: test2, error: error2 } = await supabase
    .from('imported_matches')
    .select(`
      id,
      matchday,
      home_team:teams!imported_matches_home_team_id_fkey(name),
      away_team:teams!imported_matches_away_team_id_fkey(name)
    `)
    .in('id', matchIds)

  console.log('Résultat:', test2?.length || 0, 'matchs')
  if (error2) console.error('Erreur:', error2)
  if (test2 && test2.length > 0) {
    console.log('Exemple:', test2[0])
  }

  console.log('\nTest 3: Sans filter avec teams')
  const { data: test3, error: error3 } = await supabase
    .from('imported_matches')
    .select(`
      id,
      matchday,
      home_team:teams!imported_matches_home_team_id_fkey(name),
      away_team:teams!imported_matches_away_team_id_fkey(name)
    `)
    .eq('id', matchIds[0])

  console.log('Résultat:', test3?.length || 0, 'matchs')
  if (error3) console.error('Erreur:', error3)
  if (test3 && test3.length > 0) {
    console.log('Exemple:', test3[0])
  }
}

testInQuery()
