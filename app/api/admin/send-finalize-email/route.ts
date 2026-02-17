import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { sendFinalizeRegistrationEmail } from '@/lib/email/send'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier l'authentification et les droits admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Optionnel : filtrer par emails spécifiques
    const body = await request.json().catch(() => ({}))
    const emailFilter: string[] | undefined = body.emails

    // Récupérer les users qui n'ont pas choisi leur pseudo
    let query = adminClient
      .from('profiles')
      .select('id, username, email')
      .eq('has_chosen_username', false)

    if (emailFilter && emailFilter.length > 0) {
      query = query.in('email', emailFilter)
    }

    const { data: incompleteUsers, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!incompleteUsers || incompleteUsers.length === 0) {
      return NextResponse.json({ message: 'Aucun utilisateur à relancer', sent: 0, failed: 0 })
    }

    // Envoyer un email à chaque user
    let sent = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < incompleteUsers.length; i++) {
      const u = incompleteUsers[i]
      if (!u.email) {
        failed++
        errors.push(`${u.username}: pas d'email`)
        continue
      }

      // Resend rate limit: 2 req/s → attendre 600ms entre chaque envoi
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 600))
      }

      const result = await sendFinalizeRegistrationEmail(u.email, {
        username: u.username,
        email: u.email,
      })

      if (result.success) {
        sent++
      } else {
        failed++
        errors.push(`${u.email}: ${result.error}`)
      }
    }

    return NextResponse.json({
      message: `Emails envoyés: ${sent}, échecs: ${failed}`,
      total: incompleteUsers.length,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    console.error('[ADMIN] Erreur envoi emails finalisation:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
