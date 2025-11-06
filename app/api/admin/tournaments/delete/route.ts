import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function DELETE(request: Request) {
  try {
    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Récupérer le tournoi pour confirmation
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    console.log('[DELETE] Deleting tournament:', tournament.name, tournament.id)

    // Utiliser adminClient avec service role pour bypass RLS et supprimer le tournoi
    // CASCADE supprimera automatiquement les participants et pronostics
    const { error: deleteError } = await adminClient
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)

    if (deleteError) {
      console.error('[DELETE] Error deleting tournament:', deleteError)
      throw new Error('Failed to delete tournament')
    }

    console.log('[DELETE] Tournament deleted successfully (with CASCADE):', tournament.name)

    return NextResponse.json({
      success: true,
      message: `Tournoi "${tournament.name}" supprimé avec succès`,
      tournamentId,
    })
  } catch (error: any) {
    console.error('Error deleting tournament:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
