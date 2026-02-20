import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

interface RefundSummary {
  creatorRefunded: boolean
  creatorPurchaseId?: string
  creatorUserId?: string
  participantsRefunded: number
  eventSlotsRefunded: number
}

export async function DELETE(request: Request) {
  try {
    const { tournamentId, refundCredits = false } = await request.json()

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier que l'utilisateur est super admin
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json(
        { error: 'Forbidden - Super Admin access required' },
        { status: 403 }
      )
    }

    // Récupérer le tournoi avec plus de détails
    const { data: tournament, error: tournamentError } = await adminClient
      .from('tournaments')
      .select('id, name, tournament_type, creator_id, status, competition_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    console.log('[DELETE] Deleting tournament:', tournament.name, tournament.id, 'Type:', tournament.tournament_type)

    const refundSummary: RefundSummary = {
      creatorRefunded: false,
      participantsRefunded: 0,
      eventSlotsRefunded: 0
    }

    // Si refundCredits est activé, restaurer les crédits AVANT la suppression
    if (refundCredits) {
      console.log('[DELETE] Refund credits requested')

      // 1. Restaurer le crédit du créateur (pour tournois payants)
      if (['oneshot', 'elite', 'platinium'].includes(tournament.tournament_type)) {
        const { data: creatorPurchase } = await adminClient
          .from('tournament_purchases')
          .select('id, user_id, purchase_type, tournament_subtype')
          .eq('used_for_tournament_id', tournamentId)
          .eq('used', true)
          .single()

        if (creatorPurchase) {
          const { error: restoreError } = await adminClient
            .from('tournament_purchases')
            .update({
              used: false,
              used_at: null,
              used_for_tournament_id: null,
              tournament_id: null
            })
            .eq('id', creatorPurchase.id)

          if (!restoreError) {
            refundSummary.creatorRefunded = true
            refundSummary.creatorPurchaseId = creatorPurchase.id
            refundSummary.creatorUserId = creatorPurchase.user_id
            console.log('[DELETE] Creator credit restored:', creatorPurchase.id)
          } else {
            console.error('[DELETE] Error restoring creator credit:', restoreError)
          }
        }
      }

      // 2. Restaurer les slots des participants qui ont payé
      // (slot_invite pour free-kick, platinium_participation pour platinium)
      const { data: participantPurchases } = await adminClient
        .from('tournament_purchases')
        .select('id, user_id, purchase_type')
        .eq('tournament_id', tournamentId)
        .eq('used', true)
        .in('purchase_type', ['slot_invite', 'platinium_participation'])

      if (participantPurchases && participantPurchases.length > 0) {
        for (const purchase of participantPurchases) {
          const { error: restoreError } = await adminClient
            .from('tournament_purchases')
            .update({
              used: false,
              used_at: null,
              tournament_id: null
            })
            .eq('id', purchase.id)

          if (!restoreError) {
            refundSummary.participantsRefunded++
            console.log('[DELETE] Participant credit restored:', purchase.id)
          }
        }
      }

      // 3. Restaurer les slots événement
      // Vérifier si c'est un tournoi événement
      let isEventTournament = false
      if (tournament.competition_id) {
        const { data: competition } = await adminClient
          .from('competitions')
          .select('is_event')
          .eq('id', tournament.competition_id)
          .single()
        isEventTournament = competition?.is_event || false
      }

      if (isEventTournament) {
        const { data: eventSlots } = await adminClient
          .from('event_tournament_slots')
          .select('id, user_id')
          .eq('tournament_id', tournamentId)
          .eq('status', 'used')

        if (eventSlots && eventSlots.length > 0) {
          for (const slot of eventSlots) {
            const { error: restoreError } = await adminClient
              .from('event_tournament_slots')
              .update({
                status: 'available',
                used_at: null,
                tournament_id: null
              })
              .eq('id', slot.id)

            if (!restoreError) {
              refundSummary.eventSlotsRefunded++
              console.log('[DELETE] Event slot restored:', slot.id)
            }
          }
        }
      }
    }

    // Supprimer le tournoi (CASCADE supprimera participants et pronostics)
    const { error: deleteError } = await adminClient
      .from('tournaments')
      .delete()
      .eq('id', tournamentId)

    if (deleteError) {
      console.error('[DELETE] Error deleting tournament:', deleteError)
      throw new Error('Failed to delete tournament')
    }

    console.log('[DELETE] Tournament deleted successfully (with CASCADE):', tournament.name)

    // Construire le message de résultat
    let message = `Tournoi "${tournament.name}" supprimé avec succès`
    if (refundCredits) {
      const refundParts: string[] = []
      if (refundSummary.creatorRefunded) {
        refundParts.push('crédit créateur restauré')
      }
      if (refundSummary.participantsRefunded > 0) {
        refundParts.push(`${refundSummary.participantsRefunded} crédit(s) participant(s) restauré(s)`)
      }
      if (refundSummary.eventSlotsRefunded > 0) {
        refundParts.push(`${refundSummary.eventSlotsRefunded} slot(s) événement restauré(s)`)
      }
      if (refundParts.length > 0) {
        message += ` - ${refundParts.join(', ')}`
      }
    }

    return NextResponse.json({
      success: true,
      message,
      tournamentId,
      refundSummary: refundCredits ? refundSummary : undefined
    })
  } catch (error: any) {
    console.error('Error deleting tournament:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// GET - Récupérer les infos de crédit liées à un tournoi (pour afficher dans la modal de suppression)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier que l'utilisateur est admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await adminClient
      .from('tournaments')
      .select('id, name, tournament_type, creator_id, status, competition_id')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    // Récupérer le crédit du créateur
    let creatorCredit = null
    if (['oneshot', 'elite', 'platinium'].includes(tournament.tournament_type)) {
      const { data } = await adminClient
        .from('tournament_purchases')
        .select('id, user_id, purchase_type, tournament_subtype, amount')
        .eq('used_for_tournament_id', tournamentId)
        .eq('used', true)
        .single()
      creatorCredit = data
    }

    // Récupérer les crédits des participants
    const { data: participantCredits } = await adminClient
      .from('tournament_purchases')
      .select('id, user_id, purchase_type, amount')
      .eq('tournament_id', tournamentId)
      .eq('used', true)
      .in('purchase_type', ['slot_invite', 'platinium_participation'])

    // Vérifier si tournoi événement et récupérer les slots
    let eventSlots: any[] = []
    if (tournament.competition_id) {
      const { data: competition } = await adminClient
        .from('competitions')
        .select('is_event')
        .eq('id', tournament.competition_id)
        .single()

      if (competition?.is_event) {
        const { data } = await adminClient
          .from('event_tournament_slots')
          .select('id, user_id, amount_paid')
          .eq('tournament_id', tournamentId)
          .eq('status', 'used')
        eventSlots = data || []
      }
    }

    return NextResponse.json({
      success: true,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        type: tournament.tournament_type,
        status: tournament.status
      },
      credits: {
        creator: creatorCredit,
        participants: participantCredits || [],
        eventSlots
      },
      canRefund: !!(creatorCredit || (participantCredits && participantCredits.length > 0) || eventSlots.length > 0)
    })
  } catch (error: any) {
    console.error('Error getting tournament credits:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
