require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanInvalidKingOfDay() {
  try {
    console.log('=== NETTOYAGE DES TROPHÉES "KING OF DAY" INVALIDES ===\n')

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('Utilisateur:', user.username, '\n')

    const { data: kingOfDay } = await supabase
      .from('user_trophies')
      .select('*')
      .eq('user_id', user.id)
      .eq('trophy_type', 'king_of_day')
      .maybeSingle()

    if (kingOfDay) {
      console.log('Trophée trouvé:')
      console.log('  Type:', kingOfDay.trophy_type)
      console.log('  Débloqué le:', kingOfDay.unlocked_at)
      console.log('  Est nouveau:', kingOfDay.is_new)
      console.log('')

      console.log('Ce trophée a été débloqué avec l\'ancienne logique défectueuse.')
      console.log('Selon la nouvelle logique, joueur1 n\'a jamais été SEUL premier')
      console.log('sur une journée avec points > 0.')
      console.log('')
      console.log('Suppression du trophée...')

      const { error: deleteError } = await supabase
        .from('user_trophies')
        .delete()
        .eq('user_id', user.id)
        .eq('trophy_type', 'king_of_day')

      if (deleteError) {
        console.error('✗ Erreur:', deleteError)
      } else {
        console.log('✓ Trophée supprimé')
      }
    } else {
      console.log('✓ Aucun trophée "King of Day" trouvé (déjà nettoyé)')
    }

    console.log('\n✓ Nettoyage terminé!')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

cleanInvalidKingOfDay()
