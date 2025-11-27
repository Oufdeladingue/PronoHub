import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendResultsNotificationEmail } from '@/lib/email'

// Cette route peut être appelée après la mise à jour des scores
// ou par un cron job pour notifier les résultats

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
    const { tournamentId } = body

    if (!tournamentId) {
      return NextResponse.json(
        { success: false, error: 'tournamentId requis' },
        { status: 400 }
      )
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        id,
        name,
        slug,
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

    // Récupérer tous les membres du tournoi
    const { data: members, error: membersError } = await supabase
      .from('tournament_members')
      .select(`
        user_id,
        profiles (
          email,
          username,
          notification_preferences
        )
      `)
      .eq('tournament_id', tournamentId)

    if (membersError || !members) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des membres' },
        { status: 500 }
      )
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const member of members) {
      const profile = member.profiles as any
      if (!profile?.email) continue

      // Vérifier les préférences de notification (si le champ existe)
      const prefs = profile.notification_preferences
      if (prefs && prefs.email_results === false) continue

      const result = await sendResultsNotificationEmail(profile.email, {
        username: profile.username,
        tournamentName: tournament.name,
        competitionName: (tournament.competitions as any)?.name,
        actionUrl: `https://pronohub.fr/vestiaire/${tournament.slug}`
      })

      if (result.success) {
        results.sent++
      } else {
        results.failed++
        results.errors.push(`${profile.email}: ${result.error}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Notifications de résultats envoyées: ${results.sent} succès, ${results.failed} échecs`,
      ...results
    })
  } catch (error: any) {
    console.error('Results notification API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
