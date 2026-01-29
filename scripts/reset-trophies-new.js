const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const path = require('path')

// Charger .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function resetTrophiesNew() {
  try {
    // 1. Trouver l'utilisateur Rom's directement dans auth.users
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers()

    if (userError) throw userError

    const romsUser = users.find(u =>
      u.email === 'kochroman6@gmail.com'
    )

    if (!romsUser) {
      console.log('❌ Utilisateur Rom\'s non trouvé')
      return
    }

    console.log('✅ Utilisateur trouvé:', romsUser.email)
    console.log('   User ID:', romsUser.id)

    // 2. Récupérer tous les trophées de l'utilisateur
    const { data: trophies, error: trophiesError } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', romsUser.id)
      .order('unlocked_at', { ascending: false })

    if (trophiesError) throw trophiesError

    console.log(`\n📊 Trophées trouvés: ${trophies.length}`)
    trophies.forEach((t, i) => {
      console.log(`${i + 1}. ${t.trophy_type} - is_new: ${t.is_new} - débloqué: ${t.unlocked_at}`)
    })

    if (trophies.length === 0) {
      console.log('❌ Aucun trophée trouvé')
      return
    }

    // 3. Remettre les 2 derniers trophées en is_new=true
    const trophiesToUpdate = trophies.slice(0, 2)
    const ids = trophiesToUpdate.map(t => t.id)

    console.log('\n🔄 Trophées à remettre en is_new=true:', trophiesToUpdate.map(t => t.trophy_type))

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

    console.log('\n⚠️  IMPORTANT: Efface le localStorage "trophy_last_check" dans le navigateur !')
    console.log('   Ouvre la console du navigateur et tape:')
    console.log('   localStorage.removeItem("trophy_last_check")')
    console.log('   Puis recharge la page.')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    console.error('Détails:', error)
  }
}

resetTrophiesNew()
