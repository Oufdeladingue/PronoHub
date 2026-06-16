import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Fenêtre de verrouillage : à partir de 30 min avant le coup d'envoi, les pronos ne sont plus
// modifiables (cf. /api/predictions/save) → on peut alors révéler ceux des autres joueurs.
const LOCK_BEFORE_KICKOFF_MS = 30 * 60 * 1000

/**
 * API optimisée pour charger TOUS les pronostics de TOUS les matchs d'une journée
 * en une seule requête. Remplace les appels individuels par match.
 *
 * SÉCURITÉ : route authentifiée (cookie web / Bearer Capacitor). Réservée aux participants
 * du tournoi. Les pronostics des AUTRES joueurs sont masqués tant que le match n'est pas
 * verrouillé (anti-triche) — seul le booléen `has_prediction` est exposé avant.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const { searchParams } = new URL(request.url)
    const matchIdsParam = searchParams.get('matchIds')

    if (!matchIdsParam) {
      return NextResponse.json(
        { error: 'matchIds parameter is required (comma-separated)' },
        { status: 400 }
      )
    }

    const matchIds = matchIdsParam.split(',').filter(id => id.trim())

    if (matchIds.length === 0) {
      return NextResponse.json({ predictions: {} })
    }

    // Authentification (cookie web ou Bearer Capacitor)
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Données via service-role (bypass RLS) — l'autorisation est vérifiée applicativement ci-dessous
    const supabase = createAdminClient()

    // Exécuter les requêtes en PARALLÈLE
    const [participantsResult, predictionsResult, matchesResult, tournamentResult] = await Promise.all([
      // 1. Récupérer tous les participants du tournoi (triés par ordre d'inscription)
      supabase
        .from('tournament_participants')
        .select('user_id, profiles(username, avatar), joined_at')
        .eq('tournament_id', tournamentId)
        .order('joined_at', { ascending: true }),

      // 2. Récupérer TOUTES les prédictions pour TOUS les matchs demandés
      supabase
        .from('predictions')
        .select('*, is_default_prediction')
        .eq('tournament_id', tournamentId)
        .in('match_id', matchIds),

      // 3. Récupérer les informations de TOUS les matchs
      supabase
        .from('imported_matches')
        .select('id, status, finished, utc_date')
        .in('id', matchIds),

      // 4. Récupérer le créateur du tournoi (pour l'autorisation)
      supabase
        .from('tournaments')
        .select('creator_id')
        .eq('id', tournamentId)
        .single()
    ])

    if (participantsResult.error) throw participantsResult.error
    if (predictionsResult.error) throw predictionsResult.error
    if (matchesResult.error) throw matchesResult.error

    const participants = participantsResult.data || []
    const allPredictions = predictionsResult.data || []
    const matches = matchesResult.data || []

    // Autorisation : l'appelant doit être participant du tournoi (ou son créateur)
    const isParticipant = participants.some(p => p.user_id === user.id)
    const isCreator = tournamentResult.data?.creator_id === user.id
    if (!isParticipant && !isCreator) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Créer un map pour accès rapide aux matchs
    const matchesMap = new Map(matches.map(m => [m.id, m]))
    const now = Date.now()

    // Organiser les résultats par matchId
    const result: Record<string, any[]> = {}

    for (const matchId of matchIds) {
      const matchData = matchesMap.get(matchId)
      const kickoff = matchData ? new Date(matchData.utc_date).getTime() : null
      const matchHasStarted = kickoff != null && now >= kickoff
      const matchIsFinished = matchData && (matchData.status === 'FINISHED' || matchData.finished === true)
      // Les pronos des autres ne sont révélés qu'une fois le match verrouillé (kickoff − 30 min)
      const predictionsRevealed = kickoff != null && now >= kickoff - LOCK_BEFORE_KICKOFF_MS

      // Filtrer les prédictions pour ce match
      const matchPredictions = allPredictions.filter(p => p.match_id === matchId)

      // Combiner les données pour chaque participant
      result[matchId] = participants.map(participant => {
        const pred = matchPredictions.find(p => p.user_id === participant.user_id)
        const hasPrediction = !!pred && pred.predicted_home_score !== null && pred.predicted_away_score !== null

        // Si l'utilisateur n'a pas de pronostic et que le match a commencé,
        // on applique le pronostic par défaut 0-0
        const shouldApplyDefault = !hasPrediction && (matchHasStarted || matchIsFinished)

        // Le prono est visible si : c'est le mien, OU le match est verrouillé/commencé (révélé)
        const reveal = participant.user_id === user.id || predictionsRevealed

        return {
          user_id: participant.user_id,
          username: (participant.profiles as any)?.username || 'Inconnu',
          avatar: (participant.profiles as any)?.avatar || 'avatar1',
          predicted_home_score: shouldApplyDefault ? 0 : (reveal ? (pred?.predicted_home_score ?? null) : null),
          predicted_away_score: shouldApplyDefault ? 0 : (reveal ? (pred?.predicted_away_score ?? null) : null),
          is_default_prediction: shouldApplyDefault ? true : (pred?.is_default_prediction ?? false),
          has_prediction: hasPrediction || shouldApplyDefault,
          // masked = le joueur a pronostiqué mais c'est caché à l'appelant (anti-triche, avant verrouillage)
          masked: hasPrediction && !reveal,
          predicted_qualifier: reveal ? (pred?.predicted_qualifier ?? null) : null
        }
      })
    }

    return NextResponse.json({ predictions: result })
  } catch (error: any) {
    console.error('Error fetching matchday predictions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
