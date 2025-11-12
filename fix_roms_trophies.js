require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixRomsTrophies() {
  try {
    console.log('=== CORRECTION DES TROPHÉES INVALIDES DE ROM\'S ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', "Rom's")
      .single()

    console.log('Utilisateur:', user.username, '\n')

    // Récupérer les trophées à supprimer
    const { data: trophiesToDelete } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .in('trophy_type', ['king_of_day', 'double_king'])

    console.log('Trophées invalides trouvés:', trophiesToDelete?.length || 0)

    if (trophiesToDelete && trophiesToDelete.length > 0) {
      trophiesToDelete.forEach(t => {
        console.log(`  - ${t.trophy_type}: débloqué le ${t.unlocked_at}`)
      })

      console.log('\nRaison de la suppression:')
      console.log('  Rom\'s n\'a jamais été SEUL premier sur une journée avec points > 0')
      console.log('  Toutes ses "victoires" étaient des égalités à 0 points avec d\'autres joueurs')
      console.log('  → Selon la nouvelle logique, ces trophées ne devraient pas exister\n')

      console.log('Suppression des trophées...')

      const { error: deleteError } = await supabase
        .from('user_trophies')
        .delete()
        .eq('user_id', user.id)
        .in('trophy_type', ['king_of_day', 'double_king'])

      if (deleteError) {
        console.error('✗ Erreur:', deleteError)
      } else {
        console.log('✓ Trophées supprimés')
      }
    } else {
      console.log('✓ Aucun trophée invalide trouvé (déjà nettoyé)')
    }

    // Afficher les trophées restants
    console.log('\nTrophées restants:')
    const { data: remainingTrophies } = await supabase
      .from('user_trophies')
      .select('trophy_type, unlocked_at')
      .eq('user_id', user.id)
      .order('unlocked_at', { ascending: false })

    if (remainingTrophies && remainingTrophies.length > 0) {
      remainingTrophies.forEach(t => {
        console.log(`  - ${t.trophy_type}: ${t.unlocked_at}`)
      })
    } else {
      console.log('  Aucun trophée')
    }

    console.log('\n✓ Correction terminée!')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

fixRomsTrophies()
