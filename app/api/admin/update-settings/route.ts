import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Interface pour les paramètres de MAJ auto
interface UpdateSettings {
  autoUpdateEnabled: boolean
  updateFrequency: 'hourly' | 'every_2_hours' | 'every_6_hours' | 'daily'
  updateTimeStart: string
  updateTimeEnd: string
  updateDays: string[]
  onlyActiveCompetitions: boolean
  lastCronRun: string | null
  nextScheduledRun: string | null
}

// Clés des paramètres dans la table admin_settings
const SETTINGS_KEYS = {
  autoUpdateEnabled: 'cron_auto_update_enabled',
  updateFrequency: 'cron_update_frequency',
  updateTimeStart: 'cron_update_time_start',
  updateTimeEnd: 'cron_update_time_end',
  updateDays: 'cron_update_days',
  onlyActiveCompetitions: 'cron_only_active_competitions',
  lastCronRun: 'cron_last_run',
  nextScheduledRun: 'cron_next_scheduled_run'
}

// GET - Récupérer les paramètres de MAJ auto
export async function GET() {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le rôle super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Récupérer les paramètres depuis admin_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', Object.values(SETTINGS_KEYS))

    if (settingsError) {
      console.error('Error fetching update settings:', settingsError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des paramètres' }, { status: 500 })
    }

    // Construire l'objet de paramètres
    const settingsMap: Record<string, string> = {}
    settingsData?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value
    })

    const settings: UpdateSettings = {
      autoUpdateEnabled: settingsMap[SETTINGS_KEYS.autoUpdateEnabled] === 'true',
      updateFrequency: (settingsMap[SETTINGS_KEYS.updateFrequency] as UpdateSettings['updateFrequency']) || 'hourly',
      updateTimeStart: settingsMap[SETTINGS_KEYS.updateTimeStart] || '18:00',
      updateTimeEnd: settingsMap[SETTINGS_KEYS.updateTimeEnd] || '23:59',
      updateDays: settingsMap[SETTINGS_KEYS.updateDays]
        ? JSON.parse(settingsMap[SETTINGS_KEYS.updateDays])
        : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      onlyActiveCompetitions: settingsMap[SETTINGS_KEYS.onlyActiveCompetitions] !== 'false',
      lastCronRun: settingsMap[SETTINGS_KEYS.lastCronRun] || null,
      nextScheduledRun: settingsMap[SETTINGS_KEYS.nextScheduledRun] || null
    }

    return NextResponse.json({ settings })

  } catch (error) {
    console.error('Error in GET update-settings:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Sauvegarder les paramètres de MAJ auto
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier le rôle super_admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body as { settings: UpdateSettings }

    if (!settings) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Préparer les mises à jour
    const updates = [
      { setting_key: SETTINGS_KEYS.autoUpdateEnabled, setting_value: String(settings.autoUpdateEnabled) },
      { setting_key: SETTINGS_KEYS.updateFrequency, setting_value: settings.updateFrequency },
      { setting_key: SETTINGS_KEYS.updateTimeStart, setting_value: settings.updateTimeStart },
      { setting_key: SETTINGS_KEYS.updateTimeEnd, setting_value: settings.updateTimeEnd },
      { setting_key: SETTINGS_KEYS.updateDays, setting_value: JSON.stringify(settings.updateDays) },
      { setting_key: SETTINGS_KEYS.onlyActiveCompetitions, setting_value: String(settings.onlyActiveCompetitions) }
    ]

    // Upsert chaque paramètre
    for (const update of updates) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(update, { onConflict: 'setting_key' })

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error)
        return NextResponse.json({ error: `Erreur lors de la sauvegarde de ${update.setting_key}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, message: 'Paramètres sauvegardés avec succès' })

  } catch (error) {
    console.error('Error in POST update-settings:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
