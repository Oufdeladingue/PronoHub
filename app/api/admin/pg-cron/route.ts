import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Mapping des fréquences vers les schedules cron
const FREQUENCY_TO_SCHEDULE: Record<string, string> = {
  'hourly': '0 * * * *',           // Toutes les heures
  'every_2_hours': '0 */2 * * *',  // Toutes les 2 heures
  'every_6_hours': '0 */6 * * *',  // Toutes les 6 heures
  'daily': '0 12 * * *'            // Une fois par jour à midi
}

// GET - Récupérer le statut du cron pg_cron
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

    // Appeler la fonction get_cron_status() via RPC
    const { data: cronStatus, error: cronError } = await supabase
      .rpc('get_cron_status')

    if (cronError) {
      console.error('Error fetching cron status:', cronError)
      // Si la fonction n'existe pas encore, retourner un statut par défaut
      if (cronError.message.includes('does not exist')) {
        return NextResponse.json({
          status: {
            enabled: false,
            schedule: null,
            lastRun: null,
            lastStatus: null,
            lastMessage: 'pg_cron not configured yet',
            lastCompetitionsUpdated: 0
          },
          configured: false
        })
      }
      return NextResponse.json({ error: 'Erreur lors de la récupération du statut' }, { status: 500 })
    }

    // Récupérer les derniers logs
    const { data: logs, error: logsError } = await supabase
      .from('cron_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      status: cronStatus,
      logs: logsError ? [] : logs,
      configured: true
    })

  } catch (error) {
    console.error('Error in GET pg-cron:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Activer/désactiver ou configurer le cron
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
    const { enabled, frequency } = body

    // Déterminer le schedule cron
    const schedule = frequency ? FREQUENCY_TO_SCHEDULE[frequency] || '0 * * * *' : '0 * * * *'

    // Appeler la fonction manage_update_cron() via RPC
    const { data: result, error: cronError } = await supabase
      .rpc('manage_update_cron', {
        p_enabled: enabled,
        p_schedule: schedule
      })

    if (cronError) {
      console.error('Error managing cron:', cronError)
      // Si la fonction n'existe pas encore
      if (cronError.message.includes('does not exist')) {
        return NextResponse.json({
          error: 'pg_cron non configuré. Veuillez exécuter le script SQL de migration.',
          configured: false
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Erreur lors de la configuration du cron' }, { status: 500 })
    }

    // Mettre à jour le setting dans admin_settings pour cohérence avec l'UI
    await supabase
      .from('admin_settings')
      .upsert({ setting_key: 'cron_auto_update_enabled', setting_value: String(enabled) }, { onConflict: 'setting_key' })

    if (frequency) {
      await supabase
        .from('admin_settings')
        .upsert({ setting_key: 'cron_update_frequency', setting_value: frequency }, { onConflict: 'setting_key' })
    }

    return NextResponse.json({
      success: true,
      message: result,
      enabled,
      schedule
    })

  } catch (error) {
    console.error('Error in POST pg-cron:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Exécuter manuellement le cron (pour test)
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

    // Appeler directement l'API de mise à jour
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'
    const response = await fetch(`${appUrl}/api/football/auto-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const result = await response.json()

    // Logger le résultat dans cron_logs si la table existe
    try {
      await supabase.from('cron_logs').insert({
        job_name: 'update-matches-manual',
        status: response.ok ? 'success' : 'error',
        message: result.message || result.error || 'Manual execution',
        competitions_updated: result.successCount || 0
      })
    } catch {
      // Ignore si la table n'existe pas
    }

    return NextResponse.json({
      success: response.ok,
      result
    })

  } catch (error) {
    console.error('Error in DELETE pg-cron (manual execution):', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
