import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TournamentType } from '@/types/monetization'

interface JoinTournamentRequest {
  inviteCode: string
}

export async function POST(request: NextRequest) {
  try {
    const body: JoinTournamentRequest = await request.json()
    const { inviteCode } = body

    if (!inviteCode || inviteCode.length !== 8) {
      return NextResponse.json(
        { error: 'Code invalide (8 caractères requis)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Récupérer l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour rejoindre un tournoi' },
        { status: 401 }
      )
    }

    // Chercher le tournoi avec ce code d'invitation
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, slug, invite_code, status, max_players, creator_id, tournament_type')
      .or(`invite_code.eq.${inviteCode.toUpperCase()},slug.eq.${inviteCode.toUpperCase()}`)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournoi introuvable avec ce code' },
        { status: 404 }
      )
    }

    // Vérifier que le tournoi est en attente
    if (tournament.status !== 'pending') {
      return NextResponse.json(
        { error: 'Ce tournoi a déjà commencé ou est terminé' },
        { status: 400 }
      )
    }

    // Vérifier si l'utilisateur participe déjà
    const { data: existingParticipation } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id)
      .single()

    if (existingParticipation) {
      // L'utilisateur participe déjà, rediriger quand même vers le tournoi
      const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`
      return NextResponse.json({
        success: true,
        message: 'Vous participez déjà à ce tournoi',
        tournament: {
          id: tournament.id,
          slug: tournamentSlug
        }
      })
    }

    // Vérifier les quotas de l'utilisateur selon le type de tournoi à rejoindre
    const tournamentType = (tournament.tournament_type || 'free') as TournamentType

    if (tournamentType === 'free') {
      // Compter les tournois gratuits actifs de l'utilisateur
      const { data: userParticipations } = await supabase
        .from('tournament_participants')
        .select('tournament_id')
        .eq('user_id', user.id)

      const userTournamentIds = userParticipations?.map(p => p.tournament_id) || []

      if (userTournamentIds.length > 0) {
        const { data: userFreeTournaments } = await supabase
          .from('tournaments')
          .select('id')
          .in('id', userTournamentIds)
          .eq('tournament_type', 'free')
          .neq('status', 'completed')

        const freeCount = userFreeTournaments?.length || 0

        if (freeCount >= 3) {
          return NextResponse.json(
            { error: 'Vous avez atteint votre quota de 3 tournois gratuits actifs. Ce tournoi est un tournoi gratuit.' },
            { status: 400 }
          )
        }
      }
    }
    // Les tournois premium et oneshot n'ont pas de restriction de quota pour rejoindre
    // (la restriction s'applique à la création, pas à l'invitation)

    // Vérifier le nombre de participants
    const { count: participantCount } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)

    if (participantCount && participantCount >= tournament.max_players) {
      return NextResponse.json(
        { error: 'Ce tournoi est complet' },
        { status: 400 }
      )
    }

    // Ajouter l'utilisateur au tournoi
    const { error: joinError } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournament.id,
        user_id: user.id,
        joined_at: new Date().toISOString()
      })

    if (joinError) {
      console.error('Error joining tournament:', joinError)
      return NextResponse.json(
        { error: 'Erreur lors de l\'ajout au tournoi' },
        { status: 500 }
      )
    }

    // Construire le slug complet pour la redirection
    const tournamentSlug = `${tournament.name.toLowerCase().replace(/\s+/g, '-')}_${tournament.slug || tournament.invite_code}`

    return NextResponse.json({
      success: true,
      message: 'Vous avez rejoint le tournoi avec succès',
      tournament: {
        id: tournament.id,
        slug: tournamentSlug
      }
    })

  } catch (error: any) {
    console.error('Error in join tournament route:', error)
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
