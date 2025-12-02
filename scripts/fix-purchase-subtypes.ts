/**
 * Script pour corriger les tournament_subtype manquants dans tournament_purchases
 *
 * Ce script:
 * 1. Trouve tous les achats de type 'tournament_creation' sans tournament_subtype
 * 2. Extrait le type depuis stripe_checkout_session_id si possible
 * 3. Met à jour le tournament_subtype
 */

import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Charger les variables d'environnement
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixPurchaseSubtypes() {
  console.log('Recherche des achats sans tournament_subtype...')

  // Récupérer tous les achats de type tournament_creation sans subtype
  const { data: purchases, error } = await supabase
    .from('tournament_purchases')
    .select('*')
    .eq('purchase_type', 'tournament_creation')
    .is('tournament_subtype', null)

  if (error) {
    console.error('Erreur lors de la récupération des achats:', error)
    return
  }

  console.log(`Trouvé ${purchases?.length || 0} achats à corriger`)

  if (!purchases || purchases.length === 0) {
    console.log('Aucun achat à corriger')
    return
  }

  for (const purchase of purchases) {
    console.log(`\nTraitement de l'achat ${purchase.id}:`)
    console.log(`  - User: ${purchase.user_id}`)
    console.log(`  - Amount: ${purchase.amount}€`)
    console.log(`  - Status: ${purchase.status}`)

    // Déterminer le subtype basé sur le montant
    // Prices: oneshot = 3.99€, elite = 8.99€, platinium = 6.99€
    let subtype = 'oneshot' // Par défaut

    if (purchase.amount >= 8 && purchase.amount <= 10) {
      subtype = 'elite'
    } else if (purchase.amount >= 6 && purchase.amount < 8) {
      subtype = 'platinium'
    } else if (purchase.amount >= 3 && purchase.amount < 5) {
      subtype = 'oneshot'
    }

    console.log(`  => Subtype détecté: ${subtype}`)

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('tournament_purchases')
      .update({
        tournament_subtype: subtype,
        used: purchase.used ?? false // S'assurer que used est défini
      })
      .eq('id', purchase.id)

    if (updateError) {
      console.error(`  Erreur lors de la mise à jour:`, updateError)
    } else {
      console.log(`  ✓ Mis à jour avec succès`)
    }
  }

  console.log('\n=== Terminé ===')
}

// Aussi corriger les achats avec used = null
async function fixUsedField() {
  console.log('\nCorrection des champs "used" manquants...')

  const { data, error } = await supabase
    .from('tournament_purchases')
    .update({ used: false })
    .is('used', null)
    .select('id')

  if (error) {
    console.error('Erreur:', error)
  } else {
    console.log(`${data?.length || 0} achats mis à jour avec used = false`)
  }
}

// Corriger les achats pending en completed (pour les tests locaux sans webhook)
async function fixPendingPurchases() {
  console.log('\nCorrection des achats "pending" en "completed" (mode test)...')

  const { data, error } = await supabase
    .from('tournament_purchases')
    .update({ status: 'completed' })
    .eq('status', 'pending')
    .select('id, user_id, purchase_type, tournament_subtype, amount')

  if (error) {
    console.error('Erreur:', error)
  } else if (data && data.length > 0) {
    console.log(`${data.length} achats mis à jour:`)
    data.forEach(p => {
      console.log(`  - ${p.id}: ${p.purchase_type}/${p.tournament_subtype} (${p.amount}€)`)
    })
  } else {
    console.log('Aucun achat pending à corriger')
  }
}

async function main() {
  await fixPurchaseSubtypes()
  await fixUsedField()
  await fixPendingPurchases()
}

main().catch(console.error)
