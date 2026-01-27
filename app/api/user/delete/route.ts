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

    const { confirmText } = await request.json()

    // Vérification de la confirmation
    if (confirmText !== 'SUPPRIMER MON COMPTE') {
      return NextResponse.json(
        { success: false, error: 'Confirmation invalide' },
        { status: 400 }
      )
    }

    const userId = user.id

    // Récupérer le username de l'utilisateur qui supprime son compte
    const { data: deletingProfile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    const deletingUsername = deletingProfile?.username || 'Un joueur'

    // 1. Vérifier si l'utilisateur est capitaine de tournois actifs ou en attente
    const { data: captainTournaments } = await supabaseAdmin
      .from('tournaments')
      .select('id, name, slug, invite_code, status, current_participants, competition_name')
      .eq('creator_id', userId)
      .in('status', ['pending', 'warmup', 'active'])

    if (captainTournaments && captainTournaments.length > 0) {
      // Pour chaque tournoi où l'user est capitaine, transférer ou gérer
      for (const tournament of captainTournaments) {
        // Chercher un autre participant pour transférer le capitanat
        const { data: otherParticipants } = await supabaseAdmin
          .from('tournament_participants')
          .select('user_id')
          .eq('tournament_id', tournament.id)
          .neq('user_id', userId)
          .limit(1)

        if (otherParticipants && otherParticipants.length > 0) {
          const newCaptainId = otherParticipants[0].user_id

          // Transférer le capitanat au premier participant trouvé
          await supabaseAdmin
            .from('tournaments')
            .update({ creator_id: newCaptainId })
            .eq('id', tournament.id)

          // Mettre à jour le rôle dans tournament_participants
          await supabaseAdmin
            .from('tournament_participants')
            .update({ participant_role: 'captain' })
            .eq('tournament_id', tournament.id)
            .eq('user_id', newCaptainId)

          // Envoyer un email au nouveau capitaine
          const { data: newCaptainProfile } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('id', newCaptainId)
            .single()

          const { data: newCaptainAuth } = await supabaseAdmin.auth.admin.getUserById(newCaptainId)
          const newCaptainEmail = newCaptainAuth?.user?.email

          if (newCaptainEmail) {
            const tournamentSlug = tournament.slug || `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.invite_code}`

            const emailProps: CaptainTransferEmailProps = {
              newCaptainUsername: newCaptainProfile?.username || 'Capitaine',
              oldCaptainUsername: deletingUsername,
              tournamentName: tournament.name,
              tournamentSlug: tournamentSlug,
              competitionName: tournament.competition_name || '',
              tournamentStatus: tournament.status
            }

            const { html, text, subject } = getCaptainTransferTemplate(emailProps)

            try {
              await sendEmail(newCaptainEmail, subject, html, text)
            } catch (emailError) {
              console.error('Erreur envoi email nouveau capitaine:', emailError)
              // On ne bloque pas la suppression si l'email échoue
            }
          }
        }
        // Si l'user est seul dans le tournoi, le tournoi restera sans capitaine
        // mais la suppression CASCADE retirera sa participation
      }
    }

    // 2. Supprimer les participations (les predictions suivent en CASCADE SQL)
    await supabaseAdmin
      .from('tournament_participants')
      .delete()
      .eq('user_id', userId)

    // 3. Supprimer les messages du tchat
    await supabaseAdmin
      .from('tournament_messages')
      .delete()
      .eq('user_id', userId)

    // 4. Supprimer les demandes d'équipe
    await supabaseAdmin
      .from('team_requests')
      .delete()
      .eq('user_id', userId)

    // 5. Supprimer les appartenances aux équipes
    await supabaseAdmin
      .from('tournament_team_members')
      .delete()
      .eq('user_id', userId)

    // 6. Supprimer le profil (déclenche CASCADE sur trophées, achats, etc.)
    await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    // 7. Supprimer le compte auth Supabase
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Erreur suppression auth user:', deleteError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la suppression du compte' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Compte supprimé avec succès'
    })

  } catch (error) {
    console.error('Erreur suppression compte:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    )
  }
}
