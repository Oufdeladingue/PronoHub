import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendWelcomeEmail, sendEmail } from '@/lib/email'
import { getNewUserAlertTemplate, ADMIN_EMAIL } from '@/lib/email/admin-templates'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer le profil pour avoir le username
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .single()

    const email = profile?.email || user.email
    const username = profile?.username

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email non disponible' },
        { status: 400 }
      )
    }

    // IDEMPOTENCE : garantir un envoi UNIQUE par utilisateur. Le client appelle cette route en
    // "fire-and-forget" et peut la rappeler plusieurs fois (re-clic / retry pendant le délai
    // anti-bot) → sinon N emails (bienvenue ET alerte admin). admin_settings.setting_key est UNIQUE :
    // l'INSERT sert de verrou atomique — le 1er appel gagne, les suivants sont bloqués (23505).
    const admin = createAdminClient()
    const { error: claimError } = await admin
      .from('admin_settings')
      .insert({ setting_key: `welcome_sent:${user.id}`, setting_value: new Date().toISOString() })
    if (claimError?.code === '23505') {
      return NextResponse.json({ success: true, message: 'Email de bienvenue déjà envoyé (idempotent)' })
    }
    if (claimError) {
      // Erreur non-liée au doublon → on envoie quand même (mieux vaut l'email que rien).
      console.error('[welcome] verrou idempotence échoué (envoi quand même):', claimError.message)
    }

    // Envoyer l'email de bienvenue
    const result = await sendWelcomeEmail(email, { username })

    if (!result.success) {
      console.error('Failed to send welcome email:', result.error)
      return NextResponse.json(
        { success: false, error: 'Échec de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    // Envoyer alerte admin pour nouvel utilisateur
    try {
      // Détecter si c'est une connexion Google OAuth (pas de password)
      const provider = user.app_metadata?.provider === 'google' ? 'google' : 'email'

      const { html, text, subject } = getNewUserAlertTemplate({
        email,
        username,
        provider,
        createdAt: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
      })

      await sendEmail(ADMIN_EMAIL, subject, html, text)
      console.log('New user alert email sent to admin')
    } catch (alertError) {
      console.error('Failed to send new user alert:', alertError)
      // On ne bloque pas le flux si l'alerte échoue
    }

    return NextResponse.json({
      success: true,
      message: 'Email de bienvenue envoyé'
    })
  } catch (error: any) {
    console.error('Welcome email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
