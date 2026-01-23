import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendInactiveUserReminderEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'

// Configuration
const BATCH_SIZE = 50 // Nombre d'utilisateurs à traiter par exécution
const INACTIVE_DAYS = 10 // Jours d'inactivité avant envoi

// Contenu de la notification push
const PUSH_TITLE = '🗣️ Expert foot ?'
const PUSH_BODY = 'Beaucoup de débats, zéro tournoi. PronoHub s\'inquiète.'

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON pour sécuriser l'endpoint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Vérifier si le CRON est activé
  if (!CRON_ENABLED) {
    return NextResponse.json({
      success: true,
      message: 'CRON désactivé (CRON_ENABLED=false)',
      processed: 0,
      skipped: 0
    })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    // Calculer la date limite (il y a 10 jours)
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() - INACTIVE_DAYS)

    // Fenêtre de 24h pour éviter les doublons (entre 10 et 11 jours)
    const targetDateEnd = new Date(targetDate)
    targetDateEnd.setDate(targetDateEnd.getDate() + 1)

    console.log(`[INACTIVE-REMINDER] Recherche des utilisateurs créés entre ${targetDate.toISOString()} et ${targetDateEnd.toISOString()}`)

    // 1. Récupérer les utilisateurs créés il y a exactement 10 jours
    //    qui n'ont jamais participé à un tournoi
    //    et qui n'ont pas déjà reçu cet email
    const { data: inactiveUsers, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        username,
        fcm_token,
        created_at,
        inactive_reminder_sent_at
      `)
      .gte('created_at', targetDate.toISOString())
      .lt('created_at', targetDateEnd.toISOString())
      .is('inactive_reminder_sent_at', null)
      .limit(BATCH_SIZE)

    if (usersError) {
      console.error('[INACTIVE-REMINDER] Error fetching users:', usersError)
      return NextResponse.json({ error: 'Erreur récupération utilisateurs' }, { status: 500 })
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('[INACTIVE-REMINDER] Aucun utilisateur inactif trouvé')
      return NextResponse.json({
        success: true,
        message: 'Aucun utilisateur inactif à relancer',
        processed: 0,
        skipped: 0
      })
    }

    console.log(`[INACTIVE-REMINDER] ${inactiveUsers.length} utilisateurs potentiels trouvés`)

    // 2. Vérifier lesquels n'ont pas de participation à un tournoi
    const userIds = inactiveUsers.map(u => u.id)

    const { data: participations, error: partError } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .in('user_id', userIds)

    if (partError) {
      console.error('[INACTIVE-REMINDER] Error fetching participations:', partError)
      return NextResponse.json({ error: 'Erreur récupération participations' }, { status: 500 })
    }

    // Set des user_id qui ont au moins une participation
    const usersWithTournaments = new Set(participations?.map(p => p.user_id) || [])

    // Filtrer les utilisateurs qui n'ont jamais participé
    const usersToNotify = inactiveUsers.filter(u => !usersWithTournaments.has(u.id))

    console.log(`[INACTIVE-REMINDER] ${usersToNotify.length} utilisateurs sans tournoi à notifier`)

    if (usersToNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun utilisateur inactif sans tournoi',
        processed: 0,
        skipped: inactiveUsers.length
      })
    }

    // 3. Envoyer les emails et les notifications push
    let emailsSent = 0
    let emailsFailed = 0
    let pushSent = 0
    let pushFailed = 0
    const errors: string[] = []

    for (const user of usersToNotify) {
      let emailSuccess = false
      let pushSuccess = false

      // Envoyer l'email si l'utilisateur a un email
      if (user.email) {
        try {
          const result = await sendInactiveUserReminderEmail(user.email, {
            username: user.username || ''
          })

          if (result.success) {
            emailsSent++
            emailSuccess = true
            console.log(`[INACTIVE-REMINDER] Email envoyé à ${user.email}`)
          } else {
            emailsFailed++
            errors.push(`Email ${user.email}: ${result.error}`)
            console.error(`[INACTIVE-REMINDER] Échec envoi email à ${user.email}:`, result.error)
          }
        } catch (err) {
          emailsFailed++
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Email ${user.email}: ${errorMsg}`)
          console.error(`[INACTIVE-REMINDER] Exception email pour ${user.email}:`, err)
        }
      }

      // Envoyer la notification push si l'utilisateur a un token FCM
      if (user.fcm_token) {
        try {
          const pushResult = await sendPushNotification(
            user.fcm_token,
            PUSH_TITLE,
            PUSH_BODY,
            { type: 'inactive_reminder', url: '/vestiaire' }
          )

          if (pushResult) {
            pushSent++
            pushSuccess = true
            console.log(`[INACTIVE-REMINDER] Push envoyé à user ${user.id}`)
          } else {
            pushFailed++
          }
        } catch (err) {
          pushFailed++
          const errorMsg = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`Push ${user.id}: ${errorMsg}`)
          console.error(`[INACTIVE-REMINDER] Exception push pour ${user.id}:`, err)
        }
      }

      // Marquer comme envoyé si au moins un canal a fonctionné
      if (emailSuccess || pushSuccess) {
        await supabase
          .from('profiles')
          .update({ inactive_reminder_sent_at: now.toISOString() })
          .eq('id', user.id)
      }
    }

    console.log(`[INACTIVE-REMINDER] Terminé: ${emailsSent} emails, ${pushSent} push envoyés`)

    return NextResponse.json({
      success: true,
      message: `Relance utilisateurs inactifs terminée`,
      emails: { sent: emailsSent, failed: emailsFailed },
      push: { sent: pushSent, failed: pushFailed },
      skipped: inactiveUsers.length - usersToNotify.length,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('[INACTIVE-REMINDER] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
