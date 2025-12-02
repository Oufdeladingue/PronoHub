import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: Recuperer les prix publics (pour l'affichage frontend)
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: pricing, error } = await supabase
      .from('pricing_config')
      .select('config_key, config_value, config_type, label, category')
      .eq('is_active', true)

    if (error) throw error

    // Transformer en objet cle-valeur pour faciliter l'utilisation
    const pricesMap = (pricing || []).reduce((acc, item) => {
      acc[item.config_key] = item.config_value
      return acc
    }, {} as Record<string, number>)

    // Calculer le prix du groupe Platinium
    const platiniumPrice = pricesMap['platinium_creation_price'] || 6.99
    const groupSize = pricesMap['platinium_group_size'] || 11
    const groupDiscount = pricesMap['platinium_group_discount'] || 0
    const groupPrice = platiniumPrice * groupSize * (1 - groupDiscount / 100)

    return NextResponse.json({
      success: true,
      prices: {
        // Creation tournois
        oneshot: pricesMap['oneshot_creation_price'] || 4.99,
        elite: pricesMap['elite_creation_price'] || 9.99,
        platinium: pricesMap['platinium_creation_price'] || 6.99,
        platiniumGroup: Math.round(groupPrice * 100) / 100,
        platiniumGroupSize: groupSize,

        // Extensions
        slotInvite: pricesMap['slot_invite_price'] || 0.99,
        durationExtension: pricesMap['duration_extension_price'] || 3.99,
        playerExtension: pricesMap['player_extension_price'] || 1.99,

        // Limites
        freeMaxPlayers: pricesMap['free_max_players'] || 5,
        freeMaxMatchdays: pricesMap['free_max_matchdays'] || 10,
        freeMaxTournaments: pricesMap['free_max_tournaments'] || 2,
        oneshotMaxPlayers: pricesMap['oneshot_max_players'] || 10,
        eliteMaxPlayers: pricesMap['elite_max_players'] || 20,
        platiniumMinPlayers: pricesMap['platinium_min_players'] || 11,
        platiniumMaxPlayers: pricesMap['platinium_max_players'] || 30,
        playerExtensionAmount: pricesMap['player_extension_amount'] || 5
      },
      raw: pricesMap
    })
  } catch (error: any) {
    console.error('Error fetching pricing config:', error)
    // En cas d'erreur, retourner les valeurs par defaut
    return NextResponse.json({
      success: false,
      error: error.message,
      prices: {
        oneshot: 4.99,
        elite: 9.99,
        platinium: 6.99,
        platiniumGroup: 76.89,
        platiniumGroupSize: 11,
        slotInvite: 0.99,
        durationExtension: 3.99,
        playerExtension: 1.99,
        freeMaxPlayers: 5,
        freeMaxMatchdays: 10,
        freeMaxTournaments: 2,
        oneshotMaxPlayers: 10,
        eliteMaxPlayers: 20,
        platiniumMinPlayers: 11,
        platiniumMaxPlayers: 30,
        playerExtensionAmount: 5
      }
    })
  }
}
