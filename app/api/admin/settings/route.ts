import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Récupérer tous les paramètres
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('setting_key')

    if (error) throw error

    // Transformer en objet clé-valeur pour faciliter l'utilisation
    const settingsObject = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({
      success: true,
      settings: settingsObject,
      rawSettings: settings
    })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    // Vérifier que l'utilisateur est super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'Accès refusé - Super admin requis' },
        { status: 403 }
      )
    }

    // Récupérer les paramètres à mettre à jour
    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Format de données invalide' },
        { status: 400 }
      )
    }

    // Mettre à jour chaque paramètre (ou l'insérer s'il n'existe pas)
    const updates = []
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(
          { setting_key: key, setting_value: String(value) },
          { onConflict: 'setting_key' }
        )

      if (error) {
        console.error(`Error updating setting ${key}:`, error)
        updates.push({ key, success: false, error: error.message })
      } else {
        updates.push({ key, success: true })
      }
    }

    // Vérifier si toutes les mises à jour ont réussi
    const allSuccess = updates.every(u => u.success)

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess
        ? 'Paramètres mis à jour avec succès'
        : 'Certains paramètres n\'ont pas pu être mis à jour',
      updates
    })
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
