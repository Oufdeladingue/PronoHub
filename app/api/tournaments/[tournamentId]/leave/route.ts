import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * Auto-retrait : l'utilisateur connecté quitte définitivement un tournoi.
 * - Le créateur/capitaine ne peut PAS quitter (doit d'abord transférer le capitanat).
 * - Retire : appartenance à une équipe, pronostics de CE tournoi, et la participation.
 * - Les achats (bonus, slots…) NE sont PAS remboursés (on garde les enregistrements financiers).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
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

    // Le créateur/capitaine doit transférer le capitanat avant de partir (sinon tournoi orphelin).
    const isCaptain =
      tournament.creator_id === user.id ||
      participant.participant_role === 'captain' ||
      participant.participant_role === 'creator' ||
      participant.participant_role === 'owner'
    if (isCaptain) {
      return NextResponse.json(
        { error: 'En tant que créateur, transférez d\'abord le capitanat à un autre joueur avant de quitter.' },
        { status: 400 }
      )
    }

    // Service role : suppression de ses propres données (bypass RLS après vérif de propriété).
    const admin = createAdminClient()
    await admin.from('tournament_team_members').delete().eq('tournament_id', tournamentId).eq('user_id', user.id)
    await admin.from('predictions').delete().eq('tournament_id', tournamentId).eq('user_id', user.id)
    const { error: delError } = await admin
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)

    if (delError) {
      console.error('[leave] delete participant error:', delError)
      return NextResponse.json({ error: 'Échec du retrait du tournoi' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Vous avez quitté le tournoi' })
  } catch (error: any) {
    console.error('[leave] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
