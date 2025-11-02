import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Vérifier que l'utilisateur est super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !isSuperAdmin(profile.role as UserRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Récupérer les paramètres
    const { competitionId, isActive } = await request.json()

    if (!competitionId || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Paramètres invalides' },
        { status: 400 }
      )
    }

    // Mettre à jour le statut is_active
    const { data, error } = await supabase
      .from('competitions')
      .update({ is_active: isActive })
      .eq('id', competitionId)
      .select()
      .single()

    if (error) {
      console.error('Error toggling competition active status:', error)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      competition: data,
      message: isActive
        ? 'Compétition activée avec succès'
        : 'Compétition désactivée avec succès'
    })
  } catch (error) {
    console.error('Error in toggle-active route:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
