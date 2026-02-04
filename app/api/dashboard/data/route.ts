import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

/**
 * API Route pour récupérer les données du dashboard.
 * Utilisée par le client Capacitor qui ne peut pas accéder aux Server Components.
 */
export async function GET(request: NextRequest) {
  // Récupérer le token depuis le header Authorization
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.substring(7)

  // Créer un client Supabase avec le token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  // Vérifier l'utilisateur
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = user.id

  // ========== GROUPE 1: Requêtes parallèles indépendantes ==========
  const [
    { data: profile },
    { data: subscription },
    { data: participations },
    { count: oneshotSlotsAvailable },
    { data: userCredits },
    { data: pricingConfig }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_subscriptions').select('*').eq('user_id', userId).eq('status', 'active').maybeSingle(),
    supabase.from('tournament_participants').select('tournament_id').eq('user_id', userId),
    supabase.from('user_oneshot_purchases').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'available'),
    supabase.from('user_available_credits').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('pricing_config').select('config_value').eq('config_key', 'free_max_tournaments').eq('is_active', true).maybeSingle()
  ])

  const isSuper = isSuperAdmin(profile?.role as UserRole)
  const hasSubscription = subscription?.status === 'active'
  const tournamentIds = participations?.map(p => p.tournament_id) || []
  const FREE_KICK_MAX = pricingConfig?.config_value || 2

  const credits = {
    oneshot: userCredits?.oneshot_credits || 0,
    elite: userCredits?.elite_credits || 0,
    platinium_solo: userCredits?.platinium_solo_credits || 0,
    platinium_group_slots: userCredits?.platinium_group_slots || 0,
    slot_invite: userCredits?.slot_invite_credits || 0,
    duration_extension: userCredits?.duration_extension_credits || 0,
    player_extension: userCredits?.player_extension_credits || 0,
  }

  // ========== GROUPE 2+3 ==========
  const [
    { data: participatedTournaments },
    { data: userTournaments },
    { data: leftTournaments }
  ] = await Promise.all([
    // Compter draft, active ET pending (en attente) pour les quotas Free-Kick
    supabase.from('tournaments').select('id, tournament_type, competition_id, status').in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000']).in('status', ['draft', 'active', 'pending']),
    supabase.from('tournaments').select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type, num_matchdays, actual_matchdays').in('id', tournamentIds),
    supabase.from('tournaments').select('id, name, slug, invite_code, competition_id, custom_competition_id, competition_name, creator_id, status, max_participants, max_players, starting_matchday, ending_matchday, tournament_type').eq('original_creator_id', userId).neq('status', 'completed').not('id', 'in', `(${tournamentIds.length > 0 ? tournamentIds.join(',') : '00000000-0000-0000-0000-000000000000'})`)
  ])

  // Compétitions
  const allTournamentsForCompetitions = [...(userTournaments || []), ...(leftTournaments || [])]
  const competitionIds = allTournamentsForCompetitions.map((t: any) => t.competition_id).filter(Boolean) || []
  const customCompetitionIds = allTournamentsForCompetitions.map((t: any) => t.custom_competition_id).filter(Boolean) || []
  const participatedCompetitionIds = participatedTournaments?.map(t => t.competition_id).filter(Boolean) || []
  const allCompetitionIds = [...new Set([...competitionIds, ...participatedCompetitionIds])]

  let competitionsMap: Record<number, any> = {}
  let customCompetitionsMap: Record<string, any> = {}
  let eventCompetitionIds: string[] = []

  if (allCompetitionIds.length > 0) {
    const { data: competitions } = await supabase.from('competitions').select('id, emblem, custom_emblem_white, custom_emblem_color, is_event').in('id', allCompetitionIds)
    if (competitions) {
      competitionsMap = competitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = { emblem: comp.emblem, custom_emblem_white: comp.custom_emblem_white, custom_emblem_color: comp.custom_emblem_color }
        return acc
      }, {})
      eventCompetitionIds = competitions.filter(c => c.is_event).map(c => c.id)
    }
  }

  if (customCompetitionIds.length > 0) {
    const { data: customCompetitions } = await supabase.from('custom_competitions').select('id, name, custom_emblem_white, custom_emblem_color').in('id', customCompetitionIds)
    if (customCompetitions) {
      customCompetitionsMap = customCompetitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = { name: comp.name, custom_emblem_white: comp.custom_emblem_white, custom_emblem_color: comp.custom_emblem_color }
        return acc
      }, {})
    }
  }

  // Quotas
  const freeTournamentsParticipating = participatedTournaments?.filter(t => (t.tournament_type === 'free' || !t.tournament_type) && !eventCompetitionIds.includes(t.competition_id)).length || 0
  const oneshotCreated = participatedTournaments?.filter(t => t.tournament_type === 'oneshot').length || 0
  const eliteCreated = participatedTournaments?.filter(t => t.tournament_type === 'elite').length || 0
  const platiniumCreated = participatedTournaments?.filter(t => t.tournament_type === 'platinium').length || 0
  const premiumTournamentsCreated = participatedTournaments?.filter(t => t.tournament_type === 'premium').length || 0
  const eventTournamentsParticipating = participatedTournaments?.filter(t => eventCompetitionIds.includes(t.competition_id)).length || 0

  const canCreateFree = freeTournamentsParticipating < FREE_KICK_MAX
  const canJoinFree = freeTournamentsParticipating < FREE_KICK_MAX
  const canCreatePremium = hasSubscription && premiumTournamentsCreated < 5
  const canCreateOneshot = (oneshotSlotsAvailable || 0) > 0
  const canCreateTournament = canCreateFree || canCreatePremium || canCreateOneshot

  // Participants counts
  const participantCounts: Record<string, number> = {}
  if (tournamentIds.length > 0) {
    const { data: allParticipants } = await supabase.from('tournament_participants').select('tournament_id').in('tournament_id', tournamentIds)
    if (allParticipants) {
      for (const p of allParticipants) {
        participantCounts[p.tournament_id] = (participantCounts[p.tournament_id] || 0) + 1
      }
    }
  }

  // Formater les tournois (version simplifiée pour Capacitor)
  const tournaments = (userTournaments || []).map((t: any) => {
    const tournamentSlug = `${t.name.toLowerCase().replace(/\s+/g, '-')}_${t.slug || t.invite_code}`
    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }
    const customCompetitionData = t.custom_competition_id ? customCompetitionsMap[t.custom_competition_id] : null
    const emblemData = customCompetitionData ? { emblem: null, custom_emblem_white: customCompetitionData.custom_emblem_white, custom_emblem_color: customCompetitionData.custom_emblem_color } : competitionData
    const isEventTournament = eventCompetitionIds.includes(t.competition_id)

    return {
      id: t.id,
      name: t.name,
      slug: tournamentSlug,
      code: t.slug || t.invite_code,
      competition_id: t.competition_id,
      custom_competition_id: t.custom_competition_id,
      competition_name: t.competition_name,
      creator_id: t.creator_id,
      status: t.status,
      current_participants: participantCounts[t.id] || 0,
      max_players: t.max_players || t.max_participants || 8,
      emblem: emblemData.emblem,
      custom_emblem_white: emblemData.custom_emblem_white,
      custom_emblem_color: emblemData.custom_emblem_color,
      isCaptain: t.creator_id === userId,
      journeyInfo: null,
      nextMatchDate: null,
      lastMatchDate: null,
      tournament_type: t.tournament_type || 'free',
      is_event: isEventTournament,
      winner: null,
      userRank: null,
      totalParticipants: 0,
      pendingTeamRequests: 0
    }
  })

  // Tournois quittés
  const leftTournamentsList = (leftTournaments || []).map((t: any) => {
    const competitionData = competitionsMap[t.competition_id] || { emblem: null, custom_emblem_white: null, custom_emblem_color: null }
    const customCompetitionData = t.custom_competition_id ? customCompetitionsMap[t.custom_competition_id] : null
    const emblemData = customCompetitionData ? { emblem: null, custom_emblem_white: customCompetitionData.custom_emblem_white, custom_emblem_color: customCompetitionData.custom_emblem_color } : competitionData
    const isEventTournament = eventCompetitionIds.includes(t.competition_id)

    return {
      id: t.id,
      name: t.name,
      competition_id: t.competition_id,
      custom_competition_id: t.custom_competition_id,
      competition_name: t.competition_name,
      emblem: emblemData.emblem,
      custom_emblem_white: emblemData.custom_emblem_white,
      custom_emblem_color: emblemData.custom_emblem_color,
      tournament_type: t.tournament_type || 'free',
      is_event: isEventTournament,
      status: t.status,
      hasLeft: true
    }
  })

  return NextResponse.json({
    profile,
    isSuper,
    canCreateTournament,
    hasSubscription,
    quotas: {
      freeTournaments: freeTournamentsParticipating,
      freeTournamentsMax: FREE_KICK_MAX,
      canCreateFree,
      canJoinFree,
      oneshotCreated,
      eliteCreated,
      platiniumCreated,
      eventTournaments: eventTournamentsParticipating,
      premiumTournaments: premiumTournamentsCreated,
      premiumTournamentsMax: hasSubscription ? 5 : 0,
      oneshotSlotsAvailable: oneshotSlotsAvailable || 0,
      canCreatePremium,
      canCreateOneshot,
    },
    credits,
    tournaments,
    leftTournaments: leftTournamentsList,
  })
}
