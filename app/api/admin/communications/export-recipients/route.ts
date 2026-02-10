import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { calculateRecipients } from '@/lib/admin/targeting'

/**
 * API POST /api/admin/communications/export-recipients
 * Exporte la liste des destinataires au format JSON ou CSV
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

    // Récupérer les paramètres
    const { targeting_filters, format = 'json' } = await request.json()

    console.log('[Export Recipients] Filters received:', JSON.stringify(targeting_filters))

    // Calculer les destinataires
    const recipients = await calculateRecipients(supabase, targeting_filters || {})

    console.log('[Export Recipients] Recipients found:', recipients.length)

    if (format === 'csv') {
      // Générer CSV
      const csv = [
        // Header
        'ID,Username,Email,FCM Token',
        // Rows
        ...recipients.map(r =>
          `${r.id},${r.username},"${r.email}",${r.fcm_token ? 'Oui' : 'Non'}`
        )
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="destinataires-${Date.now()}.csv"`
        }
      })
    } else {
      // Retourner JSON
      return NextResponse.json({
        success: true,
        recipients: recipients.map(r => ({
          id: r.id,
          username: r.username,
          email: r.email,
          has_fcm_token: !!r.fcm_token
        })),
        count: recipients.length
      })
    }
  } catch (error: any) {
    console.error('Error exporting recipients:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
