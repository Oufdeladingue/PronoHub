import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMatchReminderEmail } from '@/lib/email'

// Cette route peut être appelée par un cron job (ex: Vercel Cron)
// ou manuellement depuis le panel admin

export async function POST(request: NextRequest) {
  try {
    // Vérifier la clé API pour les appels automatisés (cron)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    // Si pas d'authorization header, vérifier l'auth Supabase
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: 'Non autorisé' },
          { status: 401 }
        )
      }

      // Vérifier si l'utilisateur est admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json(
          { success: false, error: 'Accès réservé aux administrateurs' },
          { status: 403 }
        )
      }
    }

    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const { tournamentId, hoursBeforeMatch = 24 } = body

    // Trouver les matchs qui commencent dans les prochaines X heures
    const now = new Date()
    const deadline = new Date(now.getTime() + hoursBeforeMatch * 60 * 60 * 1000)

    let matchesQuery = supabase
      .from('matches')
      .select(`
        id,
        match_date,
        home_team,
        away_team,
        tournaments!inner (
          id,
          name,
          slug,
          competitions (
            name
          )
        )
      `)
      .gte('match_date', now.toISOString())
      .lte('match_date', deadline.toISOString())
      .is('home_score', null) // Matchs pas encore joués

    if (tournamentId) {
      matchesQuery = matchesQuery.eq('tournaments.id', tournamentId)
    }

    const { data: upcomingMatches, error: matchesError } = await matchesQuery

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des matchs' },
        { status: 500 }
      )
    }

    if (!upcomingMatches || upcomingMatches.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun match à venir dans la période spécifiée',
        sent: 0
      })
    }

    // Pour chaque tournoi avec des matchs à venir, trouver les joueurs sans pronostics
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Grouper les matchs par tournoi
    const matchesByTournament = new Map<string, typeof upcomingMatches>()
    for (const match of upcomingMatches) {
      const tournament = match.tournaments as any
      if (!matchesByTournament.has(tournament.id)) {
        matchesByTournament.set(tournament.id, [])
      }
      matchesByTournament.get(tournament.id)!.push(match)
    }

    for (const [tId, matches] of matchesByTournament) {
      const tournament = (matches[0].tournaments as any)

      // Récupérer tous les membres du tournoi
      const { data: members } = await supabase
        .from('tournament_members')
        .select(`
          user_id,
          profiles (
            email,
            username,
            notification_preferences
          )
        `)
        .eq('tournament_id', tId)

      if (!members) continue

      // Récupérer les prédictions existantes pour ces matchs
      const matchIds = matches.map(m => m.id)
      const { data: predictions } = await supabase
        .from('predictions')
        .select('user_id, match_id')
        .in('match_id', matchIds)

      const predictionsByUser = new Map<string, Set<string>>()
      if (predictions) {
        for (const pred of predictions) {
          if (!predictionsByUser.has(pred.user_id)) {
            predictionsByUser.set(pred.user_id, new Set())
          }
          predictionsByUser.get(pred.user_id)!.add(pred.match_id)
        }
      }

      // Pour chaque membre, vérifier s'il a des pronostics manquants
      for (const member of members) {
        const profile = member.profiles as any
        if (!profile?.email) continue

        // Vérifier les préférences de notification (si le champ existe)
        const prefs = profile.notification_preferences
        if (prefs && prefs.email_reminders === false) continue

        const userPredictions = predictionsByUser.get(member.user_id) || new Set()
        const missingPredictions = matches.filter(m => !userPredictions.has(m.id))

        if (missingPredictions.length === 0) continue

        // Trouver le prochain match sans pronostic
        const nextMatch = missingPredictions.sort(
          (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
        )[0]

        const matchDate = new Date(nextMatch.match_date).toLocaleString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        })

        const result = await sendMatchReminderEmail(profile.email, {
          username: profile.username,
          tournamentName: tournament.name,
          matchDate: `${nextMatch.home_team} vs ${nextMatch.away_team} - ${matchDate}`,
          competitionName: tournament.competitions?.name,
          actionUrl: `https://pronohub.fr/vestiaire/${tournament.slug}/opposition`
        })

        if (result.success) {
          results.sent++
        } else {
          results.failed++
          results.errors.push(`${profile.email}: ${result.error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rappels envoyés: ${results.sent} succès, ${results.failed} échecs`,
      ...results
    })
  } catch (error: any) {
    console.error('Reminder email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
