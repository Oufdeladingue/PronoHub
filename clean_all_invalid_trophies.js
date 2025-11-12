require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanAllInvalidTrophies() {
  try {
    console.log('=== NETTOYAGE COMPLET DE TOUS LES TROPHÉES INVALIDES ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('Utilisateur:', user.username, '\n')

    // Supprimer tous les trophées invalides
    const trophiesToDelete = ['king_of_day', 'double_king']

    for (const trophyType of trophiesToDelete) {
      const { data: trophy } = await supabase
        .from('user_trophies')
        .select('*')
        .eq('user_id', user.id)
        .eq('trophy_type', trophyType)
        .maybeSingle()

      if (trophy) {
        console.log(`Suppression de "${trophyType}"...`)
        console.log(`  Débloqué le: ${trophy.unlocked_at}`)

        const { error: deleteError } = await supabase
          .from('user_trophies')
          .delete()
          .eq('user_id', user.id)
          .eq('trophy_type', trophyType)

        if (deleteError) {
          console.error('  ✗ Erreur:', deleteError)
        } else {
          console.log('  ✓ Supprimé')
        }
      } else {
        console.log(`"${trophyType}": déjà nettoyé`)
      }
    }

    console.log('\nRaison: joueur1 n\'a jamais été SEUL premier sur une journée avec points > 0')

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

    console.log('\n✓ Nettoyage terminé!')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

cleanAllInvalidTrophies()
