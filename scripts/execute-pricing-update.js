/**
 * Script pour mettre à jour les prix dans pricing_config
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')
const { resolve } = require('path')

// Charger les variables d'environnement
dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables Supabase manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updatePricingConfig() {
  console.log('🚀 Mise à jour des prix dans pricing_config...\n')

  try {
    // 1. Vérifier si les entrées existent
    const { data: existing, error: fetchError } = await supabase
      .from('pricing_config')
      .select('config_key, config_value')
      .in('config_key', [
        'duration_extension_price',
        'player_extension_price',
        'stats_access_tournament_price',
        'stats_access_lifetime_price'
      ])

    if (fetchError) {
      throw fetchError
    }

    console.log('📊 Entrées existantes:', existing?.length || 0)

    const existingKeys = new Set(existing?.map(e => e.config_key) || [])

    // 2. Mettre à jour ou créer les entrées
    const updates = [
      { key: 'duration_extension_price', value: 3.99, description: 'Prix de l\'extension de durée (10 journées supplémentaires)' },
      { key: 'player_extension_price', value: 1.99, description: 'Prix de l\'extension de capacité (+5 joueurs)' },
      { key: 'stats_access_tournament_price', value: 2.99, description: 'Prix des stats pour un tournoi' },
      { key: 'stats_access_lifetime_price', value: 5.99, description: 'Prix des stats à vie (tous les tournois)' }
    ]

    for (const update of updates) {
      if (existingKeys.has(update.key)) {
        // Mettre à jour
        console.log(`🔄 Mise à jour: ${update.key} = ${update.value}€`)
        const { error } = await supabase
          .from('pricing_config')
          .update({ config_value: update.value })
          .eq('config_key', update.key)

        if (error) {
          console.error(`❌ Erreur mise à jour ${update.key}:`, error.message)
        } else {
          console.log(`✅ ${update.key} mis à jour`)
        }
      } else {
        // Créer
        console.log(`➕ Création: ${update.key} = ${update.value}€`)
        const { error } = await supabase
          .from('pricing_config')
          .insert({
            config_key: update.key,
            config_value: update.value,
            is_active: true,
            description: update.description
          })

        if (error) {
          console.error(`❌ Erreur création ${update.key}:`, error.message)
        } else {
          console.log(`✅ ${update.key} créé`)
        }
      }
    }

    // 3. Afficher le résumé
    console.log('\n' + '='.repeat(80))
    console.log('✅ MISE À JOUR TERMINÉE')
    console.log('='.repeat(80))

    const { data: final } = await supabase
      .from('pricing_config')
      .select('config_key, config_value, is_active')
      .in('config_key', [
        'duration_extension_price',
        'player_extension_price',
        'stats_access_tournament_price',
        'stats_access_lifetime_price'
      ])
      .order('config_key')

    console.log('\n📋 Configuration finale:')
    final?.forEach(item => {
      console.log(`  ${item.config_key}: ${item.config_value}€ (${item.is_active ? 'actif' : 'inactif'})`)
    })
    console.log('\n' + '='.repeat(80) + '\n')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

updatePricingConfig()
