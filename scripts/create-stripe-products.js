/**
 * Script pour créer les produits d'extension dans Stripe
 *
 * Usage: node scripts/create-stripe-products.js
 */

const Stripe = require('stripe')
const dotenv = require('dotenv')
const { resolve } = require('path')

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
})

async function createProducts() {
  console.log('🚀 Création des produits Stripe en LIVE mode...\n')

  try {
    // 1. Extension de durée (3.99€)
    console.log('📅 Création: Joue les prolongations...')
    const durationProduct = await stripe.products.create({
      name: 'Joue les prolongations',
      description: 'Ajouter 10 journées supplémentaires au tournoi',
      metadata: {
        product_type: 'duration_extension'
      }
    })

    const durationPrice = await stripe.prices.create({
      product: durationProduct.id,
      unit_amount: 399, // 3.99€
      currency: 'eur',
      metadata: {
        product_type: 'duration_extension'
      }
    })

    console.log(`✅ Produit créé: ${durationProduct.id}`)
    console.log(`✅ Price ID: ${durationPrice.id}\n`)

    // 2. Extension de capacité (1.99€)
    console.log('👥 Création: Renfort du banc...')
    const playerProduct = await stripe.products.create({
      name: 'Renfort du banc',
      description: 'Ajouter 5 places supplémentaires au tournoi',
      metadata: {
        product_type: 'player_extension'
      }
    })

    const playerPrice = await stripe.prices.create({
      product: playerProduct.id,
      unit_amount: 199, // 1.99€
      currency: 'eur',
      metadata: {
        product_type: 'player_extension'
      }
    })

    console.log(`✅ Produit créé: ${playerProduct.id}`)
    console.log(`✅ Price ID: ${playerPrice.id}\n`)

    // 3. Stats à vie (5.99€)
    console.log('📊 Création: Stats du match - À vie...')
    const statsProduct = await stripe.products.create({
      name: 'Stats du match - À vie',
      description: 'Accès aux statistiques avancées pour tous vos tournois',
      metadata: {
        product_type: 'stats_access_lifetime'
      }
    })

    const statsPrice = await stripe.prices.create({
      product: statsProduct.id,
      unit_amount: 599, // 5.99€
      currency: 'eur',
      metadata: {
        product_type: 'stats_access_lifetime'
      }
    })

    console.log(`✅ Produit créé: ${statsProduct.id}`)
    console.log(`✅ Price ID: ${statsPrice.id}\n`)

    // Afficher le résumé
    console.log('\n' + '='.repeat(80))
    console.log('✅ TOUS LES PRODUITS ONT ÉTÉ CRÉÉS AVEC SUCCÈS')
    console.log('='.repeat(80))
    console.log('\n📝 Ajoute ces variables dans ton .env.local ET sur ton serveur Hetzner:\n')
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_DURATION_EXTENSION=${durationPrice.id}`)
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_PLAYER_EXTENSION=${playerPrice.id}`)
    console.log(`NEXT_PUBLIC_STRIPE_PRICE_STATS_LIFETIME=${statsPrice.id}`)
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ Erreur lors de la création des produits:', error.message)
    process.exit(1)
  }
}

createProducts()
