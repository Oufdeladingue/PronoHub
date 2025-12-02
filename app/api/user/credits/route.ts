import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    // Recuperer les credits depuis la vue
    const { data: credits, error } = await supabase
      .from('user_available_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      console.error('Error fetching credits:', error)
      // Si la vue n'existe pas encore, retourner des valeurs par defaut
      return NextResponse.json({
        oneshot_credits: 0,
        elite_credits: 0,
        platinium_solo_credits: 0,
        platinium_group_slots: 0,
        slot_invite_credits: 0,
        duration_extension_credits: 0,
        player_extension_credits: 0,
      })
    }

    return NextResponse.json({
      oneshot_credits: credits?.oneshot_credits || 0,
      elite_credits: credits?.elite_credits || 0,
      platinium_solo_credits: credits?.platinium_solo_credits || 0,
      platinium_group_slots: credits?.platinium_group_slots || 0,
      slot_invite_credits: credits?.slot_invite_credits || 0,
      duration_extension_credits: credits?.duration_extension_credits || 0,
      player_extension_credits: credits?.player_extension_credits || 0,
    })
  } catch (error) {
    console.error('Error in credits API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
