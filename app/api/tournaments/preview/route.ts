import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Endpoint public pour prévisualiser les infos d'un tournoi avant de rejoindre
// Ne nécessite pas d'authentification

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.toUpperCase()

    if (!code || code.length !== 8) {
      return NextResponse.json(
        { error: 'Code invalide (8 caractères requis)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Récupérer le tournoi par invite_code ou slug
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        slug,
        invite_code,
        status,
        max_players,
        creator_id,
        tournament_type,
        competition_id,
        custom_competition_id
      `)
      .or(`invite_code.eq.${code},slug.eq.${code}`)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournoi introuvable avec ce code' },
        { status: 404 }
      )
    }

    // Récupérer le profil du créateur
    const { data: creatorProfile } = await supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', tournament.creator_id)
      .single()

    // Récupérer les infos de compétition (standard ou custom)
    let competitionInfo: {
      name: string
      emblem: string | null
      custom_emblem_white?: string | null
      custom_emblem_color?: string | null
      is_custom: boolean
    } | null = null

    if (tournament.custom_competition_id) {
      // Compétition custom (Best of Week, etc.)
      const { data: customComp } = await supabase
        .from('custom_competitions')
        .select('name, custom_emblem_white, custom_emblem_color')
        .eq('id', tournament.custom_competition_id)
        .single()

      if (customComp) {
        competitionInfo = {
          name: customComp.name,
          emblem: null,
          custom_emblem_white: customComp.custom_emblem_white,
          custom_emblem_color: customComp.custom_emblem_color,
          is_custom: true
        }
      }
    } else if (tournament.competition_id) {
      // Compétition standard (importée)
      const { data: comp } = await supabase
        .from('competitions')
        .select('name, emblem')
        .eq('id', tournament.competition_id)
        .single()

      if (comp) {
        competitionInfo = {
          name: comp.name,
          emblem: comp.emblem,
          is_custom: false
        }
      }
    }

    // Compter les participants actuels
    const { count: participantCount } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)

    return NextResponse.json({
      success: true,
      tournament: {
        name: tournament.name,
        status: tournament.status,
        maxPlayers: tournament.max_players,
        currentPlayers: participantCount || 0,
        tournamentType: tournament.tournament_type || 'free'
      },
      creator: {
        username: creatorProfile?.username || 'Utilisateur',
        avatar: creatorProfile?.avatar || 'avatar1'
      },
      competition: competitionInfo
    })

  } catch (error: any) {
    console.error('Error in tournament preview:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
