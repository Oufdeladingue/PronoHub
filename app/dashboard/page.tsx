import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import DashboardClient from '@/components/DashboardClient'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // Récupérer le profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isSuper = isSuperAdmin(profile?.role as UserRole)

  // Récupérer la limite de tournois depuis les paramètres admin
  const { data: maxTournamentsSettings } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'max_tournaments_per_user')
    .single()

  const maxTournaments = parseInt(maxTournamentsSettings?.setting_value || '3')

  // Récupérer les IDs des tournois auxquels l'utilisateur participe
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', user.id)

  const tournamentIds = participations?.map(p => p.tournament_id) || []
  const currentTournamentCount = tournamentIds.length
  const hasReachedLimit = currentTournamentCount >= maxTournaments

  // Récupérer les détails des tournois
  const { data: userTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, competition_name, creator_id, status, current_participants, max_participants, max_players')
    .in('id', tournamentIds)

  // Récupérer les IDs de compétitions
  const competitionIds = userTournaments?.map((t: any) => t.competition_id).filter(Boolean) || []

  // Récupérer les emblèmes des compétitions
  let competitionsMap: Record<number, string> = {}
  if (competitionIds.length > 0) {
    const { data: competitions } = await supabase
      .from('competitions')
      .select('id, emblem')
      .in('id', competitionIds)

    if (competitions) {
      competitionsMap = competitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = comp.emblem
        return acc
      }, {})
    }
  }

  // Formater les données pour un accès plus facile
  const tournaments = (userTournaments || []).map((t: any) => {
    // Créer le slug complet : nom-du-tournoi_CODE
    const tournamentSlug = `${t.name.toLowerCase().replace(/\s+/g, '-')}_${t.slug || t.invite_code}`

    return {
      id: t.id,
      name: t.name,
      slug: tournamentSlug,
      code: t.slug || t.invite_code,
      competition_id: t.competition_id,
      competition_name: t.competition_name,
      creator_id: t.creator_id,
      status: t.status,
      current_participants: t.current_participants || 0,
      max_players: t.max_players || t.max_participants || 8,
      emblem: competitionsMap[t.competition_id],
      isCaptain: t.creator_id === user.id
    }
  })

  return (
    <DashboardClient
      username={profile?.username || 'utilisateur'}
      isSuper={isSuper}
      hasReachedLimit={hasReachedLimit}
      currentTournamentCount={currentTournamentCount}
      maxTournaments={maxTournaments}
      tournaments={tournaments}
    >
      {isSuper && <AdminNav />}
    </DashboardClient>
  )
}
