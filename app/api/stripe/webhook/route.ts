import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, isStripeEnabled } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { TOURNAMENT_RULES, TournamentType } from '@/types/monetization'
import { sendEmail } from '@/lib/email/send'
import { getTransactionAlertTemplate, ADMIN_EMAIL } from '@/lib/email/admin-templates'

// Client Supabase avec service role pour les webhooks (bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Vérifier si Stripe est configuré
  if (!isStripeEnabled || !stripe) {
    return NextResponse.json(
      { error: 'Stripe n\'est pas configuré' },
      { status: 503 }
    )
  }

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: any

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object)
        break

      case 'checkout.session.expired':
        await handleCheckoutExpired(event.data.object)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Handler: Checkout session completed (paiement réussi)
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.user_id
  const purchaseType = session.metadata?.purchase_type

  if (!userId || !purchaseType) {
    console.error('Missing metadata in checkout session:', session.id)
    return
  }

  console.log(`Processing payment for user ${userId}, type: ${purchaseType}`)

  // Envoyer alerte email admin pour la transaction
  try {
    // Récupérer les infos de l'utilisateur
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    const { html, text, subject } = getTransactionAlertTemplate({
      userEmail: authUser?.user?.email || 'Email inconnu',
      username: profile?.username,
      purchaseType,
      amount: session.amount_total || 0,
      currency: session.currency || 'eur',
      stripeSessionId: session.id,
      tournamentName: session.metadata?.tournament_name,
      createdAt: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
    })

    await sendEmail(ADMIN_EMAIL, subject, html, text)
    console.log('Transaction alert email sent to admin')
  } catch (emailError) {
    console.error('Failed to send transaction alert email:', emailError)
    // On ne bloque pas le flux si l'email échoue
  }

  // Mettre à jour le statut de l'achat
  const { error: updateError } = await supabaseAdmin
    .from('tournament_purchases')
    .update({
      status: 'completed',
      stripe_payment_intent_id: session.payment_intent,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', session.id)

  if (updateError) {
    console.error('Error updating purchase:', updateError)
  }

  // Traiter selon le type d'achat
  if (purchaseType.startsWith('tournament_creation_')) {
    await handleTournamentCreation(session)
  } else if (purchaseType === 'slot_invite') {
    // Le slot est déjà enregistré, rien à faire de plus
    // L'utilisateur peut maintenant rejoindre/créer un tournoi avec ce slot
    console.log('Slot invite purchased for user:', userId)
  } else if (purchaseType === 'platinium_participation') {
    await handlePlatiniumParticipation(session)
  } else if (purchaseType === 'duration_extension') {
    await handleDurationExtension(session)
  } else if (purchaseType === 'player_extension') {
    await handlePlayerExtension(session)
  }
}

// Handler: Checkout session expired
async function handleCheckoutExpired(session: any) {
  // Marquer l'achat comme expiré/échoué
  await supabaseAdmin
    .from('tournament_purchases')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_checkout_session_id', session.id)

  console.log('Checkout session expired:', session.id)
}

// Créer un tournoi après paiement
async function handleTournamentCreation(session: any) {
  const userId = session.metadata?.user_id
  const purchaseType = session.metadata?.purchase_type
  const tournamentDataStr = session.metadata?.tournament_data

  if (!tournamentDataStr) {
    console.error('No tournament data in metadata')
    return
  }

  const tournamentData = JSON.parse(tournamentDataStr)

  // Déterminer le type de tournoi
  let tournamentType: TournamentType = 'free'
  if (purchaseType === 'tournament_creation_oneshot') tournamentType = 'oneshot'
  else if (purchaseType === 'tournament_creation_elite') tournamentType = 'elite'
  else if (purchaseType === 'tournament_creation_platinium') tournamentType = 'platinium'

  const rules = TOURNAMENT_RULES[tournamentType]

  // Créer le tournoi
  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .insert({
      name: tournamentData.name,
      slug: tournamentData.slug,
      invite_code: tournamentData.slug,
      competition_id: parseInt(tournamentData.competitionId),
      competition_name: tournamentData.competitionName,
      max_players: Math.min(tournamentData.maxPlayers || rules.maxPlayers, rules.maxPlayers),
      max_participants: Math.min(tournamentData.maxPlayers || rules.maxPlayers, rules.maxPlayers),
      num_matchdays: tournamentData.numMatchdays,
      matchdays_count: tournamentData.numMatchdays,
      max_matchdays: rules.maxMatchdays,
      all_matchdays: tournamentData.allMatchdays,
      bonus_match_enabled: tournamentData.bonusMatchEnabled,
      creator_id: userId,
      original_creator_id: userId,
      status: 'pending',
      current_participants: 1,
      scoring_exact_score: 3,
      scoring_correct_winner: 1,
      scoring_correct_goal_difference: 2,
      scoring_default_prediction_max: tournamentData.drawWithDefaultPredictionPoints || 1,
      tournament_type: tournamentType,
      is_legacy: false,
      duration_extended: false,
      players_extended: 0,
    })
    .select()
    .single()

  if (tournamentError) {
    console.error('Error creating tournament:', tournamentError)
    return
  }

  // Ajouter le créateur comme capitaine
  await supabaseAdmin
    .from('tournament_participants')
    .insert({
      tournament_id: tournament.id,
      user_id: userId,
      participant_role: 'captain',
      invite_type: 'free',
      has_paid: true,
      amount_paid: rules.creationPrice,
    })

  // Créer les journées du tournoi
  const journeys = []
  for (let i = 1; i <= tournamentData.numMatchdays; i++) {
    journeys.push({
      tournament_id: tournament.id,
      journey_number: i,
      status: 'pending',
    })
  }

  await supabaseAdmin
    .from('tournament_journeys')
    .insert(journeys)

  // Mettre à jour l'achat avec l'ID du tournoi
  await supabaseAdmin
    .from('tournament_purchases')
    .update({ tournament_id: tournament.id })
    .eq('stripe_checkout_session_id', session.id)

  console.log('Tournament created:', tournament.id, 'Type:', tournamentType)
}

// Rejoindre un tournoi Platinium après paiement
async function handlePlatiniumParticipation(session: any) {
  const userId = session.metadata?.user_id
  const inviteCode = session.metadata?.invite_code

  if (!inviteCode) {
    console.error('No invite code in metadata')
    return
  }

  // Trouver le tournoi
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('id')
    .or(`invite_code.eq.${inviteCode.toUpperCase()},slug.eq.${inviteCode.toUpperCase()}`)
    .single()

  if (!tournament) {
    console.error('Tournament not found:', inviteCode)
    return
  }

  // Ajouter le participant
  await supabaseAdmin
    .from('tournament_participants')
    .insert({
      tournament_id: tournament.id,
      user_id: userId,
      participant_role: 'member',
      invite_type: 'paid_slot',
      has_paid: true,
      amount_paid: 6.99,
    })

  // Mettre à jour l'achat avec l'ID du tournoi
  await supabaseAdmin
    .from('tournament_purchases')
    .update({ tournament_id: tournament.id })
    .eq('stripe_checkout_session_id', session.id)

  console.log('User', userId, 'joined Platinium tournament:', tournament.id)
}

// Extension de durée
async function handleDurationExtension(session: any) {
  const tournamentId = session.metadata?.tournament_id

  if (!tournamentId) {
    console.error('No tournament_id in metadata')
    return
  }

  await supabaseAdmin
    .from('tournaments')
    .update({
      duration_extended: true,
      max_matchdays: null, // Illimité
    })
    .eq('id', tournamentId)

  console.log('Duration extended for tournament:', tournamentId)
}

// Extension de joueurs (+5)
async function handlePlayerExtension(session: any) {
  const tournamentId = session.metadata?.tournament_id

  if (!tournamentId) {
    console.error('No tournament_id in metadata')
    return
  }

  // Récupérer le tournoi actuel
  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('max_players, players_extended')
    .eq('id', tournamentId)
    .single()

  if (!tournament) {
    console.error('Tournament not found:', tournamentId)
    return
  }

  await supabaseAdmin
    .from('tournaments')
    .update({
      max_players: tournament.max_players + 5,
      max_participants: tournament.max_players + 5,
      players_extended: (tournament.players_extended || 0) + 5,
    })
    .eq('id', tournamentId)

  console.log('Players extended for tournament:', tournamentId)
}
