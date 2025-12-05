import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRLS() {
  console.log('Vérification RLS sur la table tournaments...\n')

  // Vérifier si RLS est activé
  const { data: tableInfo, error: tableError } = await supabase
    .rpc('check_rls_enabled', { p_table: 'tournaments' })
    .single()

  if (tableError) {
    console.log('Fonction check_rls_enabled non disponible, vérifions autrement...')
  }

  // Requête SQL directe pour voir les politiques
  const { data: policies, error: policiesError } = await supabase
    .from('pg_policies')
    .select('*')

  if (policiesError) {
    console.log('Erreur pg_policies:', policiesError.message)

    // Essayons une requête SQL brute via rpc
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
        FROM pg_policies
        WHERE tablename = 'tournaments'
      `
    })

    if (error) {
      console.log('Pas possible de récupérer les politiques directement')
    } else {
      console.log('Policies:', data)
    }
  } else {
    const tournamentPolicies = policies?.filter((p: any) => p.tablename === 'tournaments')
    console.log('Policies sur tournaments:', tournamentPolicies)
  }

  // Test: essayer de récupérer le tournoi avec anon key
  console.log('\n--- Test avec anon key ---')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const anonClient = createClient(supabaseUrl, anonKey)

  const { data: anonTournaments, error: anonError } = await anonClient
    .from('tournaments')
    .select('id, name, invite_code')
    .eq('invite_code', 'WOPXQQWJ')

  console.log('Avec anon key:')
  console.log('  Résultats:', anonTournaments?.length || 0)
  console.log('  Erreur:', anonError?.message || 'aucune')
}

checkRLS()
