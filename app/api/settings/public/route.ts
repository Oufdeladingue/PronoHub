import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Récupérer uniquement les paramètres publics (non sensibles)
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .in('setting_key', ['free_tier_max_players', 'points_exact_score', 'points_correct_result'])

    if (error) throw error

    // Transformer en objet clé-valeur
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value
      return acc
    }, {} as Record<string, string>)

    // Valeurs par défaut si les paramètres n'existent pas encore
    const publicSettings = {
      free_tier_max_players: settingsObject.free_tier_max_players || '10',
      points_exact_score: settingsObject.points_exact_score || '3',
      points_correct_result: settingsObject.points_correct_result || '1'
    }

    return NextResponse.json({
      success: true,
      settings: publicSettings
    })
  } catch (error: any) {
    console.error('Error fetching public settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
