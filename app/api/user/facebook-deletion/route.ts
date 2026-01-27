import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Callback de suppression de données Facebook
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Facebook envoie un POST signé quand un utilisateur demande la suppression de ses données.
 * On doit retourner une URL de statut et un code de confirmation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const signedRequest = body.get('signed_request') as string

    if (!signedRequest) {
      return NextResponse.json(
        { error: 'signed_request manquant' },
        { status: 400 }
      )
    }

    // Décoder le signed_request de Facebook
    const [encodedSig, payload] = signedRequest.split('.')
    const appSecret = process.env.FACEBOOK_APP_SECRET

    if (!appSecret) {
      console.error('[Facebook Deletion] FACEBOOK_APP_SECRET non configuré')
      return NextResponse.json(
        { error: 'Configuration serveur manquante' },
        { status: 500 }
      )
    }

    // Vérifier la signature HMAC-SHA256
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    if (encodedSig !== expectedSig) {
      console.error('[Facebook Deletion] Signature invalide')
      return NextResponse.json(
        { error: 'Signature invalide' },
        { status: 403 }
      )
    }

    // Décoder le payload
    const decodedPayload = JSON.parse(
      Buffer.from(payload, 'base64').toString('utf-8')
    )
    const facebookUserId = decodedPayload.user_id

    console.log('[Facebook Deletion] Demande de suppression pour Facebook user:', facebookUserId)

    // Générer un code de confirmation unique
    const confirmationCode = crypto.randomBytes(16).toString('hex')

    // Chercher l'utilisateur Supabase lié à ce Facebook ID
    const supabaseAdmin = createAdminClient()

    // Supabase stocke le provider ID dans auth.users.raw_app_meta_data
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    const matchingUser = users?.users?.find(u => {
      const providers = u.app_metadata?.providers || []
      const identities = u.identities || []
      return identities.some(
        (identity: any) => identity.provider === 'facebook' && identity.id === facebookUserId
      )
    })

    if (matchingUser) {
      console.log('[Facebook Deletion] Utilisateur trouvé:', matchingUser.id)

      // Supprimer les données de l'utilisateur (même logique que /api/user/delete)
      const userId = matchingUser.id

      // Supprimer les participations
      await supabaseAdmin
        .from('tournament_participants')
        .delete()
        .eq('user_id', userId)

      // Supprimer les messages
      await supabaseAdmin
        .from('tournament_messages')
        .delete()
        .eq('user_id', userId)

      // Supprimer les demandes d'équipe
      await supabaseAdmin
        .from('team_requests')
        .delete()
        .eq('user_id', userId)

      // Supprimer les appartenances aux équipes
      await supabaseAdmin
        .from('tournament_team_members')
        .delete()
        .eq('user_id', userId)

      // Supprimer le profil (CASCADE)
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

      // Supprimer le compte auth
      await supabaseAdmin.auth.admin.deleteUser(userId)

      console.log('[Facebook Deletion] Utilisateur supprimé:', userId)
    } else {
      console.log('[Facebook Deletion] Aucun utilisateur trouvé pour Facebook ID:', facebookUserId)
    }

    // Retourner la réponse au format attendu par Facebook
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'
    const statusUrl = `${baseUrl}/api/user/facebook-deletion/status?code=${confirmationCode}`

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    })
  } catch (error) {
    console.error('[Facebook Deletion] Erreur:', error)
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    )
  }
}
