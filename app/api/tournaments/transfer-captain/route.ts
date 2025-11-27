import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { getCaptainTransferTemplate, CaptainTransferEmailProps } from '@/lib/email/templates'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const supabaseAdmin = createAdminClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      )
    }

    const { tournamentId, newCaptainId } = await request.json()

    if (!tournamentId || !newCaptainId) {
      return NextResponse.json(
        { success: false, error: 'Données manquantes' },
        { status: 400 }
      )
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, slug, invite_code, creator_id, competition_name, status')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi introuvable' },
        { status: 404 }
      )
    }

    // Vérifier que l'utilisateur actuel est le capitaine
    if (tournament.creator_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Seul le capitaine peut transférer le capitanat' },
        { status: 403 }
      )
    }

    // Vérifier que le nouveau capitaine est bien participant du tournoi
    const { data: participant, error: participantError } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', newCaptainId)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { success: false, error: 'Ce joueur ne participe pas au tournoi' },
        { status: 400 }
      )
    }

    // Récupérer les informations du nouveau capitaine
    const { data: newCaptainProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', newCaptainId)
      .single()

    if (profileError || !newCaptainProfile) {
      return NextResponse.json(
        { success: false, error: 'Profil du nouveau capitaine introuvable' },
        { status: 404 }
      )
    }

    // Récupérer le profil de l'ancien capitaine (pour l'email)
    const { data: oldCaptainProfile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    // Effectuer le transfert (avec client admin pour bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('tournaments')
      .update({ creator_id: newCaptainId })
      .eq('id', tournamentId)

    if (updateError) {
      console.error('Error updating captain:', updateError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors du transfert' },
        { status: 500 }
      )
    }

    // Récupérer l'email du nouveau capitaine via auth.users (avec client admin)
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(newCaptainId)
    const newCaptainEmail = authUser?.user?.email

    // Envoyer un email au nouveau capitaine
    if (newCaptainEmail) {
      const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`

      const emailProps: CaptainTransferEmailProps = {
        newCaptainUsername: newCaptainProfile.username || 'Capitaine',
        oldCaptainUsername: oldCaptainProfile?.username || 'L\'ancien capitaine',
        tournamentName: tournament.name,
        tournamentSlug: tournamentSlug,
        competitionName: tournament.competition_name,
        tournamentStatus: tournament.status
      }

      const { html, text, subject } = getCaptainTransferTemplate(emailProps)

      try {
        await sendEmail(newCaptainEmail, subject, html, text)
      } catch (emailError) {
        console.error('Error sending captain transfer email:', emailError)
        // On ne bloque pas le transfert si l'email échoue
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Capitanat transféré avec succès',
      newCaptain: {
        id: newCaptainId,
        username: newCaptainProfile.username
      }
    })

  } catch (error: any) {
    console.error('Error in captain transfer:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
