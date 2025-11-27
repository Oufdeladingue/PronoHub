import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTournamentInviteEmail } from '@/lib/email'

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

    const body = await request.json()
    const { email, tournamentId } = body

    if (!email || !tournamentId) {
      return NextResponse.json(
        { success: false, error: 'Email et tournamentId requis' },
        { status: 400 }
      )
    }

    // Récupérer les infos du tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        name,
        invite_code,
        competition_id,
        competitions (
          name
        )
      `)
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouvé' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur est le créateur du tournoi
    const { data: isCreator } = await supabase
      .from('tournaments')
      .select('id')
      .eq('id', tournamentId)
      .eq('created_by', user.id)
      .single()

    if (!isCreator) {
      return NextResponse.json(
        { success: false, error: 'Vous n\'êtes pas autorisé à inviter dans ce tournoi' },
        { status: 403 }
      )
    }

    // Récupérer le username de l'inviteur
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    // Envoyer l'email d'invitation
    const result = await sendTournamentInviteEmail(email, {
      username: profile?.username,
      tournamentName: tournament.name,
      inviteCode: tournament.invite_code,
      competitionName: (tournament.competitions as any)?.name
    })

    if (!result.success) {
      console.error('Failed to send invite email:', result.error)
      return NextResponse.json(
        { success: false, error: 'Échec de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation envoyée par email'
    })
  } catch (error: any) {
    console.error('Invite email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
