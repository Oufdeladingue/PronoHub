import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET() {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Récupérer tous les profils avec les infos nécessaires
    const { data: profiles } = await adminClient
      .from('profiles')
      .select('id, email, username, has_chosen_username, last_seen_at, created_at')

    if (!profiles) {
      return NextResponse.json({ error: 'Erreur récupération profils' }, { status: 500 })
    }

    // Compter les participants (users qui ont rejoint au moins un tournoi)
    const { data: participantsData } = await adminClient
      .from('tournament_participants')
      .select('user_id')

    const usersWithTournament = new Set(participantsData?.map(p => p.user_id) || [])

    // Compter les users avec au moins un pronostic non-default
    const { data: predictionsData } = await adminClient
      .from('predictions')
      .select('user_id')
      .eq('is_default_prediction', false)

    const usersWithPrediction = new Set(predictionsData?.map(p => p.user_id) || [])

    // Calculer les métriques globales
    const allIds = new Set(profiles.map(p => p.id))
    const totalSignups = profiles.length

    // Détecter Google vs Email : Google users ont souvent un username = préfixe email
    // Plus fiable : les users avec has_chosen_username = false ont un username auto-généré (Google)
    // Pour être précis, on compte ceux dont le provider est Google dans auth.users
    // Mais on n'a pas accès directement. On estime par le pattern.
    const emailSignups = profiles.filter(p => {
      // Si le username a été choisi ET diffère du préfixe email, c'est potentiellement un signup email
      // Approximation : on regarde si le created_at a un last_seen_at proche (signup email classique)
      return p.email && !p.email.includes('gmail.com') && !p.email.includes('googlemail.com')
    }).length
    const googleSignups = totalSignups - emailSignups

    const usernameChosen = profiles.filter(p => p.has_chosen_username === true).length
    const usernameNotChosen = profiles.filter(p => p.has_chosen_username !== true).length
    const hasSeenDashboard = profiles.filter(p => p.last_seen_at !== null).length
    const hasJoinedTournament = profiles.filter(p => usersWithTournament.has(p.id)).length
    const hasMadePrediction = profiles.filter(p => usersWithPrediction.has(p.id)).length

    // Par semaine (4 dernières)
    const now = new Date()
    const periods = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekProfiles = profiles.filter(p => {
        const created = new Date(p.created_at)
        return created >= weekStart && created < weekEnd
      })

      const weekIds = new Set(weekProfiles.map(p => p.id))

      periods.push({
        label: `${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`,
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
        signups: weekProfiles.length,
        usernameChosen: weekProfiles.filter(p => p.has_chosen_username === true).length,
        hasSeenDashboard: weekProfiles.filter(p => p.last_seen_at !== null).length,
        hasJoinedTournament: weekProfiles.filter(p => usersWithTournament.has(p.id)).length,
        hasMadePrediction: weekProfiles.filter(p => usersWithPrediction.has(p.id)).length,
      })
    }

    return NextResponse.json({
      success: true,
      funnel: {
        totalSignups,
        googleSignups,
        emailSignups,
        usernameChosen,
        usernameNotChosen,
        hasSeenDashboard,
        hasJoinedTournament,
        hasMadePrediction,
        periods,
      }
    })
  } catch (error: any) {
    console.error('Error in funnel API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
