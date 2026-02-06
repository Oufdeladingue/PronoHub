/**
 * Script pour créer le produit Stats pour un tournoi unique dans Stripe
 *
 * Usage: node scripts/create-stripe-product-stats-tournament.js
 */

const Stripe = require('stripe')
const dotenv = require('dotenv')
const { resolve } = require('path')

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
})

async function createStatsTournamentProduct() {
  console.log('🚀 Création du produit Stats pour un tournoi...\n')

  try {
    // Stats pour un tournoi uniquement (2.99€)
    console.log('📊 Création: Stats du match - Ce tournoi...')
    const statsTournamentProduct = await stripe.products.create({
      name: 'Stats du match - Ce tournoi',
      description: 'Accès aux statistiques avancées pour ce tournoi uniquement',
      metadata: {
        product_type: 'stats_access_tournament'
      }
    })

    const statsTournamentPrice = await stripe.prices.create({
      product: statsTournamentProduct.id,
      unit_amount: 299, // 2.99€
      currency: 'eur',
      metadata: {
        product_type: 'stats_access_tournament'
      }
    })

    console.log(`✅ Produit créé: ${statsTournamentProduct.id}`)
    console.log(`✅ Price ID: ${statsTournamentPrice.id}\n`)

    // Afficher le résumé
    console.log('\n' + '='.repeat(80))
    console.log('✅ PRODUIT STATS TOURNOI CRÉÉ AVEC SUCCÈS')
    console.log('='.repeat(80))
    console.log('\n📝 Ajoute cette variable dans ton .env.local ET sur ton serveur Hetzner:\n')
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_STATS_TOURNAMENT=${statsTournamentPrice.id}`)
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ Erreur lors de la création du produit:', error.message)
    process.exit(1)
  }
}

createStatsTournamentProduct()
