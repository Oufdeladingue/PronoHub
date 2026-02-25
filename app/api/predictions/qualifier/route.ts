import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    // Vérifier l'authentification
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const body = await request.json()
    const { matchId, tournamentId, choice } = body

    if (!matchId || !tournamentId || !choice) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    if (choice !== 'home' && choice !== 'away') {
      return NextResponse.json({ error: 'Choix invalide' }, { status: 400 })
    }

    // Utiliser le client admin pour bypass RLS (la colonne predicted_qualifier
    // peut ne pas être accessible via le client anon à cause du cache PostgREST)
    const adminClient = createAdminClient()

    // Vérifier que la prédiction existe et appartient à l'utilisateur
    const { data: existing, error: fetchError } = await adminClient
      .from('predictions')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Aucune prédiction trouvée pour ce match' },
        { status: 404 }
      )
    }

    // Mettre à jour le qualifié
    const { data: updated, error: updateError } = await adminClient
      .from('predictions')
      .update({ predicted_qualifier: choice })
      .eq('id', existing.id)
      .select('id, predicted_qualifier')
      .single()

    if (updateError) {
      console.error('[Qualifier API] Erreur update:', updateError)
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      predicted_qualifier: updated.predicted_qualifier
    })
  } catch (err) {
    console.error('[Qualifier API] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
