import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { calculateRecipients } from '@/lib/admin/targeting'

/**
 * API POST /api/admin/communications/count-recipients
 * Compte le nombre de destinataires selon les filtres de ciblage
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

    // Récupérer les filtres de ciblage
    const { targeting_filters } = await request.json()

    // Calculer les destinataires
    const recipients = await calculateRecipients(supabase, targeting_filters || {})

    // Compter par canal
    const emailCount = recipients.filter(r => r.email).length
    const pushCount = recipients.filter(r => r.fcm_token).length

    return NextResponse.json({
      success: true,
      total: recipients.length,
      emailRecipients: emailCount,
      pushRecipients: pushCount,
      bothChannels: recipients.filter(r => r.email && r.fcm_token).length
    })
  } catch (error: any) {
    console.error('Error counting recipients:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
