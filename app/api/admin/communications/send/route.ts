import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'

/**
 * API POST /api/admin/communications/send
 * Envoie une communication immédiatement à tous les utilisateurs ciblés
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier les droits super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    // Récupérer l'ID de la communication
    const { communicationId } = await request.json()

    if (!communicationId) {
      return NextResponse.json({ success: false, error: 'ID communication manquant' }, { status: 400 })
    }

    // Charger la communication
    const { data: communication, error: commError } = await supabase
      .from('admin_communications')
      .select('*')
      .eq('id', communicationId)
      .single()

    if (commError || !communication) {
      return NextResponse.json({ success: false, error: 'Communication non trouvée' }, { status: 404 })
    }

    // Vérifier que la communication est un brouillon
    if (communication.status !== 'draft') {
      return NextResponse.json({ success: false, error: 'Cette communication a déjà été envoyée' }, { status: 400 })
    }

    // Vérifier qu'il y a au moins un contenu
    const hasEmail = communication.email_subject && communication.email_body_html
    const hasPush = communication.notification_title && communication.notification_body

    if (!hasEmail && !hasPush) {
      return NextResponse.json({ success: false, error: 'Aucun contenu à envoyer' }, { status: 400 })
    }

    // Récupérer les destinataires (Phase 1 MVP: tous les users avec email)
    // Phase 2 : utiliser calculate_communication_recipients() avec les filtres
    const { data: recipients, error: recipientsError } = await supabase
      .from('profiles')
      .select('id, email, fcm_token, username')
      .not('email', 'is', null)

    if (recipientsError || !recipients) {
      return NextResponse.json({ success: false, error: 'Erreur chargement destinataires' }, { status: 500 })
    }

    // Statistiques d'envoi
    let emailsSent = 0
    let emailsFailed = 0
    let pushSent = 0
    let pushFailed = 0

    // Envoyer par batch de 50
    const BATCH_SIZE = 50
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)

      // Envoyer les emails et notifications en parallèle
      await Promise.all(
        batch.map(async (recipient) => {
          const logs: Array<{
            communication_id: string
            user_id: string
            channel: 'email' | 'push'
            status: 'sent' | 'failed'
            error_message: string | null
            sent_at: string
            resend_message_id: string | null
          }> = []

          // Envoyer l'email si configuré
          if (hasEmail && recipient.email) {
            try {
              const result = await sendEmail(
                recipient.email,
                communication.email_subject!,
                communication.email_body_html!,
                communication.email_preview_text || undefined
              )

              if (result.success) {
                emailsSent++
                logs.push({
                  communication_id: communicationId,
                  user_id: recipient.id,
                  channel: 'email',
                  status: 'sent',
                  error_message: null,
                  sent_at: new Date().toISOString(),
                  resend_message_id: result.messageId || null
                })
              } else {
                emailsFailed++
                logs.push({
                  communication_id: communicationId,
                  user_id: recipient.id,
                  channel: 'email',
                  status: 'failed',
                  error_message: result.error || 'Erreur inconnue',
                  sent_at: new Date().toISOString(),
                  resend_message_id: null
                })
              }
            } catch (error: any) {
              emailsFailed++
              logs.push({
                communication_id: communicationId,
                user_id: recipient.id,
                channel: 'email',
                status: 'failed',
                error_message: error.message,
                sent_at: new Date().toISOString(),
                resend_message_id: null
              })
            }
          }

          // Envoyer la notification push si configurée et si l'utilisateur a un token FCM
          if (hasPush && recipient.fcm_token) {
            try {
              await sendPushNotification(
                recipient.fcm_token,
                communication.notification_title!,
                communication.notification_body!,
                {
                  type: 'admin_communication',
                  communicationId,
                  clickUrl: communication.notification_click_url || '/dashboard'
                },
                communication.notification_image_url || undefined
              )

              pushSent++
              logs.push({
                communication_id: communicationId,
                user_id: recipient.id,
                channel: 'push',
                status: 'sent',
                error_message: null,
                sent_at: new Date().toISOString(),
                resend_message_id: null
              })
            } catch (error: any) {
              pushFailed++
              logs.push({
                communication_id: communicationId,
                user_id: recipient.id,
                channel: 'push',
                status: 'failed',
                error_message: error.message,
                sent_at: new Date().toISOString(),
                resend_message_id: null
              })
            }
          }

          // Sauvegarder les logs
          if (logs.length > 0) {
            await supabase.from('admin_communication_logs').insert(logs)
          }
        })
      )

      // Petite pause entre les batches pour éviter de surcharger
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Mettre à jour la communication avec les stats
    await supabase
      .from('admin_communications')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        stats_total_recipients: recipients.length,
        stats_emails_sent: emailsSent,
        stats_emails_failed: emailsFailed,
        stats_push_sent: pushSent,
        stats_push_failed: pushFailed
      })
      .eq('id', communicationId)

    return NextResponse.json({
      success: true,
      totalSent: recipients.length,
      emailsSent,
      emailsFailed,
      pushSent,
      pushFailed
    })
  } catch (error: any) {
    console.error('Error sending communication:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
