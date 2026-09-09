import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Auto-retrait : l'utilisateur connecté quitte définitivement un tournoi.
 * - Le créateur/capitaine doit désigner un SUCCESSEUR (body { newCaptainId }) : on transfère le
 *   capitanat PUIS on le retire, dans la même requête (sinon tournoi orphelin).
 * - Retire : appartenance à une équipe, pronostics de CE tournoi, et la participation.
 * - Les achats (bonus, slots…) NE sont PAS remboursés (on garde les enregistrements financiers).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const body = await request.json().catch(() => ({} as any))
    const newCaptainId: string | undefined = body?.newCaptainId
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, creator_id, status, name')
      .eq('id', tournamentId)
      .single()
    if (!tournament) {
      return NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 })
    }

    const { data: participant } = await supabase
      .from('tournament_participants')
      .select('id, participant_role')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!participant) {
      return NextResponse.json({ error: 'Vous ne participez pas à ce tournoi' }, { status: 400 })
    }

    // Service role : bypass RLS après vérification de propriété.
    const admin = createAdminClient()

    // Créateur/capitaine : il doit désigner un SUCCESSEUR avant de partir (sinon tournoi orphelin).
    // Transfert du capitanat + départ dans la même requête.
    const isCaptain =
      tournament.creator_id === user.id ||
      participant.participant_role === 'captain' ||
      participant.participant_role === 'creator' ||
      participant.participant_role === 'owner'
    if (isCaptain) {
      if (!newCaptainId || newCaptainId === user.id) {
        return NextResponse.json(
          { error: 'En tant que créateur, choisissez un successeur pour le capitanat avant de quitter.', needsSuccessor: true },
          { status: 400 }
        )
      }
      const { data: succ } = await admin
        .from('tournament_participants')
        .select('user_id')
        .eq('tournament_id', tournamentId)
        .eq('user_id', newCaptainId)
        .maybeSingle()
      if (!succ) {
        return NextResponse.json({ error: 'Le successeur choisi ne participe pas au tournoi.' }, { status: 400 })
      }
      const { error: transferError } = await admin
        .from('tournaments')
        .update({ creator_id: newCaptainId })
        .eq('id', tournamentId)
      if (transferError) {
        console.error('[leave] transfer captain error:', transferError)
        return NextResponse.json({ error: 'Échec du transfert du capitanat' }, { status: 500 })
      }
    }
    // ABANDON SOFT : on ne supprime RIEN. On marque la participation comme abandonnée.
    // - La ligne participant + les pronostics restent en base (le joueur reste affiché GRISÉ,
    //   hors classement, chez les autres ; il n'est plus éligible aux trophées).
    // - La place reste RÉSERVÉE (pas de décrément de current_participants ni de quota).
    // - L'appartenance à une équipe est conservée telle quelle.
    // Le capitaine a déjà transféré le capitanat ci-dessus (creator_id) avant d'arriver ici.
    const { error: abandonError } = await admin
      .from('tournament_participants')
      .update({ abandoned_at: new Date().toISOString() })
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)

    if (abandonError) {
      console.error('[leave] abandon update error:', abandonError)
      return NextResponse.json({ error: 'Échec de l\'abandon du tournoi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Vous avez quitté le tournoi' })
  } catch (error: any) {
    console.error('[leave] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
