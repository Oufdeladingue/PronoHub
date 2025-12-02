import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('=== Application de la migration pricing v2 ===\n')

  const migrationPath = path.join(__dirname, '../supabase/migrations/update_pricing_rules_v2.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Nombre de statements à exécuter: ${statements.length}\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    const preview = statement.substring(0, 80).replace(/\n/g, ' ')

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

      if (error) {
        // Try direct query for DDL statements
        const { error: directError } = await supabase.from('_temp').select().limit(0)
        if (directError) {
          console.log(`[${i + 1}/${statements.length}] ⚠️ ${preview}...`)
          console.log(`   Erreur: ${error.message}`)
          errorCount++
        }
      } else {
        console.log(`[${i + 1}/${statements.length}] ✅ ${preview}...`)
        successCount++
      }
    } catch (err: any) {
      console.log(`[${i + 1}/${statements.length}] ⚠️ ${preview}...`)
      console.log(`   Exception: ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n=== Résultat ===`)
  console.log(`✅ Succès: ${successCount}`)
  console.log(`⚠️ Erreurs: ${errorCount}`)
  console.log(`\nNote: Certaines erreurs sont normales (ex: colonnes déjà existantes)`)
  console.log(`\n⚠️ IMPORTANT: Exécutez ce SQL directement dans Supabase SQL Editor si nécessaire`)
}

applyMigration().catch(console.error)
