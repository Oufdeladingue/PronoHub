import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { executeAutoUpdate } from '@/app/api/football/auto-update/route'
import { executeRealtimeUpdate } from '@/app/api/football/realtime-update/route'

// Interface pour les paramètres du système intelligent
interface SmartCronSettings {
  // Sync quotidienne
  dailySyncEnabled: boolean
  dailySyncHour: string // Format HH:MM
  delayBetweenCompetitions: number // Secondes

  // Mode temps réel
  realtimeEnabled: boolean
  smartModeEnabled: boolean // Utiliser le calendrier intelligent
  realtimeFrequency: number // Minutes (quand en fenêtre de match)
  marginBeforeKickoff: number // Minutes avant le coup d'envoi
  marginAfterMatch: number // Minutes après le temps réglementaire

  // Mode fallback (si smart mode désactivé)
  fallbackInterval: number // Minutes
  fallbackTimeStart: string // HH:MM
  fallbackTimeEnd: string // HH:MM

  // Quotas API
  minDelayBetweenCalls: number // Secondes
}

// Clés des paramètres dans admin_settings
const SETTINGS_KEYS = {
  dailySyncEnabled: 'cron_daily_sync_enabled',
  dailySyncHour: 'cron_daily_sync_hour',
  delayBetweenCompetitions: 'cron_delay_between_competitions',
  realtimeEnabled: 'cron_auto_update_enabled',
  smartModeEnabled: 'cron_smart_mode_enabled',
  realtimeFrequency: 'cron_realtime_frequency',
  marginBeforeKickoff: 'cron_margin_before_kickoff',
  marginAfterMatch: 'cron_margin_after_match',
  fallbackInterval: 'cron_fallback_interval',
  fallbackTimeStart: 'cron_fallback_time_start',
  fallbackTimeEnd: 'cron_fallback_time_end',
  minDelayBetweenCalls: 'cron_min_delay_between_calls',
  lastRun: 'cron_last_run'
}

const DEFAULT_SETTINGS: SmartCronSettings = {
  dailySyncEnabled: true,
  dailySyncHour: '06:00',
  delayBetweenCompetitions: 5,
  realtimeEnabled: false,
  smartModeEnabled: true,
  realtimeFrequency: 2,
  marginBeforeKickoff: 5,
  marginAfterMatch: 30,
  fallbackInterval: 15,
  fallbackTimeStart: '14:00',
  fallbackTimeEnd: '23:59',
  minDelayBetweenCalls: 6
}

// GET - Récupérer le statut complet du système
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
    const { data: settingsData } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', Object.values(SETTINGS_KEYS))

    const settingsMap: Record<string, string> = {}
    settingsData?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value
    })

    // Construire l'objet settings
    const settings: SmartCronSettings = {
      dailySyncEnabled: settingsMap[SETTINGS_KEYS.dailySyncEnabled] !== 'false',
      dailySyncHour: settingsMap[SETTINGS_KEYS.dailySyncHour] || DEFAULT_SETTINGS.dailySyncHour,
      delayBetweenCompetitions: parseInt(settingsMap[SETTINGS_KEYS.delayBetweenCompetitions]) || DEFAULT_SETTINGS.delayBetweenCompetitions,
      realtimeEnabled: settingsMap[SETTINGS_KEYS.realtimeEnabled] === 'true',
      smartModeEnabled: settingsMap[SETTINGS_KEYS.smartModeEnabled] !== 'false',
      realtimeFrequency: parseInt(settingsMap[SETTINGS_KEYS.realtimeFrequency]) || DEFAULT_SETTINGS.realtimeFrequency,
      marginBeforeKickoff: parseInt(settingsMap[SETTINGS_KEYS.marginBeforeKickoff]) || DEFAULT_SETTINGS.marginBeforeKickoff,
      marginAfterMatch: parseInt(settingsMap[SETTINGS_KEYS.marginAfterMatch]) || DEFAULT_SETTINGS.marginAfterMatch,
      fallbackInterval: parseInt(settingsMap[SETTINGS_KEYS.fallbackInterval]) || DEFAULT_SETTINGS.fallbackInterval,
      fallbackTimeStart: settingsMap[SETTINGS_KEYS.fallbackTimeStart] || DEFAULT_SETTINGS.fallbackTimeStart,
      fallbackTimeEnd: settingsMap[SETTINGS_KEYS.fallbackTimeEnd] || DEFAULT_SETTINGS.fallbackTimeEnd,
      minDelayBetweenCalls: parseInt(settingsMap[SETTINGS_KEYS.minDelayBetweenCalls]) || DEFAULT_SETTINGS.minDelayBetweenCalls
    }

    // Récupérer le statut pg_cron via RPC
    let cronStatus = null
    let configured = true
    try {
      const { data: status, error: cronError } = await supabase.rpc('get_smart_cron_status')
      if (cronError) {
        if (cronError.message.includes('does not exist')) {
          configured = false
        }
      } else {
        cronStatus = status
      }
    } catch {
      configured = false
    }

    // Récupérer les logs récents
    const { data: logs } = await supabase
      .from('cron_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)

    // Récupérer les fenêtres de matchs actives
    let matchWindows: any[] = []
    try {
      const { data: windows } = await supabase
        .from('match_windows')
        .select('*, competitions(name)')
        .gte('window_end', new Date().toISOString())
        .order('window_start', { ascending: true })
        .limit(10)
      matchWindows = windows || []
    } catch {
      // Table peut ne pas exister
    }

    // Compter les appels API du jour
    let apiCallsToday = 0
    try {
      const { data: apiData } = await supabase.rpc('get_api_calls_today')
      apiCallsToday = apiData || 0
    } catch {
      // Fonction peut ne pas exister
    }

    return NextResponse.json({
      settings,
      cronStatus,
      logs: logs || [],
      matchWindows,
      apiCallsToday,
      configured,
      lastRun: settingsMap[SETTINGS_KEYS.lastRun] || null
    })

  } catch (error) {
    console.error('Error in GET smart-cron:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Sauvegarder les paramètres et configurer les crons
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
    const { settings } = body as { settings: SmartCronSettings }

    if (!settings) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Préparer les mises à jour
    const updates = [
      { setting_key: SETTINGS_KEYS.dailySyncEnabled, setting_value: String(settings.dailySyncEnabled) },
      { setting_key: SETTINGS_KEYS.dailySyncHour, setting_value: settings.dailySyncHour },
      { setting_key: SETTINGS_KEYS.delayBetweenCompetitions, setting_value: String(settings.delayBetweenCompetitions) },
      { setting_key: SETTINGS_KEYS.realtimeEnabled, setting_value: String(settings.realtimeEnabled) },
      { setting_key: SETTINGS_KEYS.smartModeEnabled, setting_value: String(settings.smartModeEnabled) },
      { setting_key: SETTINGS_KEYS.realtimeFrequency, setting_value: String(settings.realtimeFrequency) },
      { setting_key: SETTINGS_KEYS.marginBeforeKickoff, setting_value: String(settings.marginBeforeKickoff) },
      { setting_key: SETTINGS_KEYS.marginAfterMatch, setting_value: String(settings.marginAfterMatch) },
      { setting_key: SETTINGS_KEYS.fallbackInterval, setting_value: String(settings.fallbackInterval) },
      { setting_key: SETTINGS_KEYS.fallbackTimeStart, setting_value: settings.fallbackTimeStart },
      { setting_key: SETTINGS_KEYS.fallbackTimeEnd, setting_value: settings.fallbackTimeEnd },
      { setting_key: SETTINGS_KEYS.minDelayBetweenCalls, setting_value: String(settings.minDelayBetweenCalls) }
    ]

    // Sauvegarder dans admin_settings
    for (const update of updates) {
      const { error } = await supabase
        .from('admin_settings')
        .upsert(update, { onConflict: 'setting_key' })

      if (error) {
        console.error(`Error updating ${update.setting_key}:`, error)
        return NextResponse.json({ error: `Erreur lors de la sauvegarde de ${update.setting_key}` }, { status: 500 })
      }
    }

    // Configurer pg_cron via RPC
    let cronResult = null
    try {
      const { data, error: cronError } = await supabase.rpc('manage_smart_cron', {
        p_daily_enabled: settings.dailySyncEnabled,
        p_daily_hour: settings.dailySyncHour,
        p_realtime_enabled: settings.realtimeEnabled,
        p_realtime_frequency_minutes: settings.realtimeFrequency
      })

      if (cronError) {
        if (cronError.message.includes('does not exist')) {
          return NextResponse.json({
            success: true,
            message: 'Paramètres sauvegardés. pg_cron non configuré - exécutez le script SQL.',
            configured: false
          })
        }
        throw cronError
      }
      cronResult = data
    } catch (err: any) {
      console.error('Error configuring cron:', err)
      return NextResponse.json({
        success: true,
        message: 'Paramètres sauvegardés mais erreur cron: ' + err.message,
        configured: false
      })
    }

    return NextResponse.json({
      success: true,
      message: cronResult || 'Paramètres sauvegardés avec succès',
      configured: true
    })

  } catch (error) {
    console.error('Error in POST smart-cron:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT - Générer les fenêtres de matchs
export async function PUT() {
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

    // Générer les fenêtres via RPC
    const { data, error } = await supabase.rpc('generate_match_windows')

    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({
          error: 'Fonction non disponible. Exécutez le script SQL smart_cron_setup.sql',
          configured: false
        }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      windowsGenerated: data,
      message: `${data} fenêtres de matchs générées`
    })

  } catch (error) {
    console.error('Error in PUT smart-cron:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Exécuter une MAJ manuelle
// Query param: ?type=realtime (mise à jour ciblée) ou ?type=full (mise à jour complète)
export async function DELETE(request: Request) {
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

    // Vérifier que la clé API Football Data est configurée
    const apiKey = process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'Clé API Football Data non configurée. Ajoutez FOOTBALL_DATA_API_KEY dans les variables d\'environnement.'
      }, { status: 500 })
    }

    // Déterminer le type de mise à jour (par défaut: realtime)
    const url = new URL(request.url)
    const updateType = url.searchParams.get('type') || 'realtime'

    // Appeler la fonction appropriée
    const result = updateType === 'full'
      ? await executeAutoUpdate()
      : await executeRealtimeUpdate()

    // Logger dans cron_logs
    try {
      await supabase.from('cron_logs').insert({
        job_name: updateType === 'full' ? 'manual-update' : 'manual-realtime',
        status: result.success ? 'success' : 'error',
        message: result.message || result.error || 'Manual execution',
        competitions_updated: result.successCount || 0
      })
    } catch {
      // Ignore logging errors
    }

    // Mettre à jour last_run
    await supabase
      .from('admin_settings')
      .upsert({ setting_key: 'cron_last_run', setting_value: new Date().toISOString() }, { onConflict: 'setting_key' })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Erreur lors de la mise à jour',
        result
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error: any) {
    console.error('Error in DELETE smart-cron:', error)
    return NextResponse.json({
      error: `Erreur serveur: ${error.message}`
    }, { status: 500 })
  }
}
