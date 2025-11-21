require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function finalCleanupRoms() {
  try {
    console.log('=== NETTOYAGE FINAL ET DÉFINITIF DES TROPHÉES DE ROM\'S ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '\n')

    // Supprimer TOUS les trophées problématiques
    const { data: deleted, error: deleteError } = await supabase
      .from('user_trophies')
      .delete()
      .eq('user_id', user.id)
      .in('trophy_type', ['king_of_day', 'double_king'])
      .select()

    if (deleteError) {
      console.error('Erreur lors de la suppression:', deleteError)
    } else {
      console.log(`✓ ${deleted?.length || 0} trophées supprimés`)
      deleted?.forEach(t => {
        console.log(`  - ${t.trophy_type}`)
      })
    }

    // Vérifier le résultat
    console.log('\nVérification finale:')
    const { data: remaining } = await supabase
      .from('user_trophies')
      .select('trophy_type, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    console.log(`\nTrophées restants: ${remaining?.length || 0}`)
    if (remaining && remaining.length > 0) {
      remaining.forEach(t => {
        console.log(`  - ${t.trophy_type}: ${t.unlocked_at}`)
      })
    }

    // Vérifier qu'aucun trophée problématique ne reste
    const hasKingOfDay = remaining?.some(t => t.trophy_type === 'king_of_day')
    const hasDoubleKing = remaining?.some(t => t.trophy_type === 'double_king')

    if (hasKingOfDay || hasDoubleKing) {
      console.log('\n⚠️ ATTENTION: Des trophées problématiques persistent!')
      if (hasKingOfDay) console.log('  - king_of_day est toujours présent')
      if (hasDoubleKing) console.log('  - double_king est toujours présent')
    } else {
      console.log('\n✅ SUCCÈS: Tous les trophées invalides ont été supprimés!')
    }

    console.log('\n✓ Nettoyage terminé!')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

finalCleanupRoms()
