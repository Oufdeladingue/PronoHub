import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/firebase-admin'
import { calculateRecipients } from '@/lib/admin/targeting'

/**
 * Remplace les variables utilisateur dans un texte
 */
function replaceUserVariables(text: string, user: { username: string; email: string }): string {
  return text
    .replace(/\[username\]/gi, user.username || 'Utilisateur')
    .replace(/\[email\]/gi, user.email || '')
}

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

    // Récupérer l'ID de la communication et les canaux sélectionnés
    const { communicationId, sendEmail, sendPush } = await request.json()

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

    // Les communications peuvent être renvoyées (pas de vérification de statut)
    // Cela permet de modifier les filtres et renvoyer à d'autres destinataires

    // Vérifier qu'il y a au moins un contenu et que le canal est activé
    // Utiliser les canaux passés en paramètre au lieu de ceux en base
    const shouldSendEmail = sendEmail === true
    const shouldSendPush = sendPush === true
    const hasEmail = shouldSendEmail && communication.email_subject && communication.email_body_html
    const hasPush = shouldSendPush && communication.notification_title && communication.notification_body

    if (!hasEmail && !hasPush) {
      return NextResponse.json({ success: false, error: 'Aucun contenu à envoyer ou aucun canal activé' }, { status: 400 })
    }

    // Récupérer les destinataires selon les filtres de ciblage
    const recipients = await calculateRecipients(supabase, communication.targeting_filters || {})

    if (!recipients || recipients.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucun destinataire trouvé avec ces filtres' }, { status: 400 })
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
              // Remplacer les variables utilisateur et CTA
              const personalizedSubject = replaceUserVariables(communication.email_subject!, recipient)
              let personalizedBody = replaceUserVariables(communication.email_body_html!, recipient)
              personalizedBody = personalizedBody
                .replace(/\[HEADER_TITLE\]/gi, personalizedSubject)
                .replace(/\[CTA_TEXT\]/gi, communication.email_cta_text || 'Découvrir')
                .replace(/\[CTA_URL\]/gi, communication.email_cta_url || 'https://www.pronohub.club/dashboard')
              const personalizedPreview = communication.email_preview_text
                ? replaceUserVariables(communication.email_preview_text, recipient)
                : undefined

              const result = await sendEmail(
                recipient.email,
                personalizedSubject,
                personalizedBody,
                personalizedPreview
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
              // Remplacer les variables utilisateur
              const personalizedTitle = replaceUserVariables(communication.notification_title!, recipient)
              const personalizedBody = replaceUserVariables(communication.notification_body!, recipient)

              await sendPushNotification(
                recipient.fcm_token,
                personalizedTitle,
                personalizedBody,
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
