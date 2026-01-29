const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// Charger .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetTrophiesSQL() {
  try {
    // Utiliser rpc pour exécuter du SQL brut
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: `
        UPDATE user_trophies
        SET is_new = true
        WHERE id IN (
          SELECT ut.id
          FROM user_trophies ut
          JOIN auth.users u ON u.id = ut.user_id
          WHERE (u.email ILIKE '%rom%' OR u.raw_user_meta_data->>'username' ILIKE '%rom%')
          ORDER BY ut.unlocked_at DESC
          LIMIT 2
        )
        RETURNING *;
      `
    })

    if (error) {
      console.error('❌ Erreur RPC:', error.message)

      // Fallback: méthode manuelle
      console.log('\n🔄 Tentative avec méthode manuelle...')

      // 1. Lister tous les users
      const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()
      if (userError) throw userError

      console.log(`\n📋 ${users.length} utilisateurs trouvés`)

      // Afficher tous les users pour debug
      users.forEach(u => {
        console.log(`   - ${u.email} (ID: ${u.id})`)
      })

      const romsUser = users.find(u =>
        u.email === 'kochroman6@gmail.com'
      )

      if (!romsUser) {
        console.log('\n❌ Utilisateur Rom\'s non trouvé')
        console.log('Utilisateurs disponibles:', users.map(u => u.email).join(', '))
        return
      }

      console.log('\n✅ Utilisateur trouvé:', romsUser.email)
      console.log('   User ID:', romsUser.id)

      // 2. Récupérer ses trophées
      const { data: trophies, error: trophiesError } = await supabase
        .from('user_trophies')
        .select('*')
        .eq('user_id', romsUser.id)
        .order('unlocked_at', { ascending: false })

      if (trophiesError) throw trophiesError

      console.log(`\n📊 Trophées trouvés: ${trophies.length}`)

      if (trophies.length === 0) {
        console.log('❌ Aucun trophée à mettre à jour')
        return
      }

      trophies.forEach((t, i) => {
        console.log(`${i + 1}. ${t.trophy_type} - is_new: ${t.is_new} - débloqué: ${t.unlocked_at}`)
      })

      // 3. Update les 2 premiers
      const trophiesToUpdate = trophies.slice(0, 2)
      const ids = trophiesToUpdate.map(t => t.id)

      console.log('\n🔄 Mise à jour de:', trophiesToUpdate.map(t => t.trophy_type))

      const { data: updated, error: updateError } = await supabase
        .from('user_trophies')
        .update({ is_new: true })
        .in('id', ids)
        .select()

      if (updateError) throw updateError

      console.log('\n✅ Trophées mis à jour:', updated.length)
      updated.forEach(t => {
        console.log(`   - ${t.trophy_type} (ID: ${t.id}) -> is_new: ${t.is_new}`)
      })

    } else {
      console.log('✅ Requête SQL exécutée avec succès')
      console.log('Résultat:', data)
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Détails:', error)
  }
}

resetTrophiesSQL()
