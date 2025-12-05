import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { competitionId, isEvent } = await request.json()

    if (!competitionId) {
      return NextResponse.json(
        { error: 'competitionId is required' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Mettre à jour le statut is_event
    const { error: updateError } = await supabase
      .from('competitions')
      .update({ is_event: isEvent })
      .eq('id', competitionId)

    if (updateError) {
      console.error('Error updating competition is_event:', updateError)
      return NextResponse.json(
        { error: 'Failed to update competition' },
        { status: 500 }
      )
    }

    // Récupérer le nom de la compétition pour le message
    const { data: competition } = await supabase
      .from('competitions')
      .select('name')
      .eq('id', competitionId)
      .single()

    return NextResponse.json({
      success: true,
      message: isEvent
        ? `${competition?.name || 'Compétition'} marquée comme événement`
        : `${competition?.name || 'Compétition'} n'est plus un événement`
    })
  } catch (error: any) {
    console.error('Error in toggle-event route:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
