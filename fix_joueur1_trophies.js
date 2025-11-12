require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixJoueur1Trophies() {
  try {
    console.log('=== CORRECTION DES TROPHÉES JOUEUR1 ===\n')

    // Trouver joueur1
    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('Utilisateur:', user.username, '| ID:', user.id, '\n')

    // 1. Supprimer le trophée "Ballon d'or" qui ne devrait pas exister
    console.log('1. Suppression du trophée "Ballon d\'or" (tournament_winner)...')

    const { data: ballonDor } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'tournament_winner')
      .maybeSingle()

    if (ballonDor) {
      console.log(`   Trouvé: débloqué le ${ballonDor.unlocked_at}`)

      const { error: deleteError } = await supabase
        .from('user_trophies')
        .delete()
        .eq('user_id', user.id)
        .eq('trophy_type', 'tournament_winner')

      if (deleteError) {
        console.error('   ✗ Erreur lors de la suppression:', deleteError)
      } else {
        console.log('   ✓ Trophée supprimé')
      }
    } else {
      console.log('   ⚠️ Trophée non trouvé (déjà supprimé?)')
    }

    // 2. Afficher les trophées restants
    console.log('\n2. Trophées restants:')
    const { data: remainingTrophies } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    if (remainingTrophies && remainingTrophies.length > 0) {
      remainingTrophies.forEach(t => {
        console.log(`   - ${t.trophy_type}: ${t.unlocked_at}`)
      })
    } else {
      console.log('   Aucun trophée')
    }

    console.log('\n✓ Correction terminée!')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

fixJoueur1Trophies()
