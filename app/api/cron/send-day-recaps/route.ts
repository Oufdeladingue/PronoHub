import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendMatchdayRecapEmail } from '@/lib/email/send'
import { calculatePoints, type PointsSettings } from '@/lib/scoring'

// Mettre CRON_ENABLED=true dans les variables d'environnement pour activer
const CRON_ENABLED = process.env.CRON_ENABLED === 'true'

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON pour sécuriser l'endpoint
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[DAY-RECAP] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!CRON_ENABLED) {
    return NextResponse.json({
      success: true,
      message: 'CRON désactivé (CRON_ENABLED=false)',
      processed: 0,
      skipped: 0
    })
  }

  try {
    const supabase = createAdminClient()
    const now = new Date()

    console.log('[DAY-RECAP] Starting day recap process at:', now.toISOString())

    // 1. Récupérer tous les tournois actifs
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'active')

    if (tournamentsError) {
      console.error('[DAY-RECAP] Error fetching tournaments:', tournamentsError)
      return NextResponse.json({ error: 'Error fetching tournaments' }, { status: 500 })
    }

    if (!tournaments || tournaments.length === 0) {
      console.log('[DAY-RECAP] No active tournaments found')
      return NextResponse.json({ success: true, message: 'No active tournaments', processed: 0 })
    }

    console.log(`[DAY-RECAP] Found ${tournaments.length} active tournaments`)

    // 2. Récupérer les paramètres de scoring globaux
    const { data: pointsSettingsData } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

    const exactScoreSetting = pointsSettingsData?.find(s => s.setting_key === 'points_exact_score')
    const correctResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_correct_result')
    const incorrectResultSetting = pointsSettingsData?.find(s => s.setting_key === 'points_incorrect_result')

    let totalEmailsSent = 0
    let totalSkipped = 0
    let totalErrors = 0
    const errors: string[] = []

    // 3. Traiter chaque tournoi
    for (const tournament of tournaments) {
      try {
        let competitionName = 'Compétition'
        if (tournament.custom_competition_id) {
          const { data: customComp } = await supabase
            .from('custom_competitions')
            .select('name')
            .eq('id', tournament.custom_competition_id)
            .single()
          competitionName = customComp?.name || 'Compétition custom'
        } else if (tournament.competition_id) {
          const { data: comp } = await supabase
            .from('competitions')
            .select('name')
            .eq('id', tournament.competition_id)
            .single()
          competitionName = comp?.name || 'Compétition'
        }

        const isCustom = !!tournament.custom_competition_id

        // Déterminer la range de journées
        let startMatchday = tournament.starting_matchday
        let endMatchday = tournament.ending_matchday

        if (isCustom && (!startMatchday || !endMatchday)) {
          const { data: customMatchdays } = await supabase
            .from('custom_competition_matchdays')
            .select('matchday_number')
            .eq('custom_competition_id', tournament.custom_competition_id)
            .order('matchday_number', { ascending: true })

          if (customMatchdays && customMatchdays.length > 0) {
            startMatchday = customMatchdays[0].matchday_number
            endMatchday = customMatchdays[customMatchdays.length - 1].matchday_number
          }
        }

        if (!startMatchday || !endMatchday) {
          console.log(`[DAY-RECAP] Tournament ${tournament.name}: no matchdays defined, skipping`)
          continue
        }

        const matchdaysInRange = Array.from(
          { length: endMatchday - startMatchday + 1 },
          (_, i) => startMatchday + i
        )

        const tournamentStartDate = tournament.start_date ? new Date(tournament.start_date) : null

        // 4. Récupérer tous les matchs du tournoi et détecter les journées terminées
        const finishedMatchdays = await getFinishedMatchdays(
          supabase, tournament, matchdaysInRange, tournamentStartDate, isCustom
        )

        if (finishedMatchdays.length === 0) {
          continue
        }

        // 5. Récupérer les participants
        const { data: participants } = await supabase
          .from('tournament_participants')
          .select('user_id, profiles(username, avatar, email)')
          .eq('tournament_id', tournament.id)

        if (!participants || participants.length === 0) continue

        // 6. Pour chaque journée terminée, vérifier si le recap a déjà été envoyé
        for (const matchday of finishedMatchdays) {
          // Vérifier si au moins un recap a déjà été envoyé pour cette journée/tournoi
          const { data: existingLogs } = await supabase
            .from('notification_logs')
            .select('user_id')
            .eq('notification_type', 'matchday_recap')
            .eq('tournament_id', tournament.id)
            .eq('matchday', matchday)
            .eq('channel', 'email')
            .eq('status', 'sent')
            .limit(1)

          if (existingLogs && existingLogs.length > 0) {
            console.log(`[DAY-RECAP] Tournament "${tournament.name}" J${matchday}: already sent, skipping`)
            continue
          }

          console.log(`[DAY-RECAP] Processing tournament "${tournament.name}" J${matchday}`)

          // 7. Calculer les classements pour cette journée
          const pointsSettings: PointsSettings = {
            exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
            correctResult: parseInt(correctResultSetting?.setting_value || '1'),
            incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0'),
            drawWithDefaultPrediction: tournament.scoring_draw_with_default_prediction ?? 0
          }

          const { matchdayRankingData, generalRankingData } = await calculateMatchdayAndGeneralRankings(
            supabase, tournament, matchday, matchdaysInRange, participants, pointsSettings, tournamentStartDate, isCustom
          )

          // 8. Envoyer les emails aux participants
          for (const participant of participants) {
            const profile = participant.profiles as any
            const userId = participant.user_id
            const email = profile?.email
            const username = profile?.username || 'Joueur'

            if (!email) {
              totalSkipped++
              continue
            }

            // Vérifier la préférence utilisateur
            const { data: prefs } = await supabase
              .from('user_notification_preferences')
              .select('email_day_recap')
              .eq('user_id', userId)
              .single()

            // Si la préférence existe et est désactivée, skip
            if (prefs && prefs.email_day_recap === false) {
              totalSkipped++
              continue
            }

            // Vérifier si déjà envoyé à cet utilisateur spécifique
            const { data: userLog } = await supabase
              .from('notification_logs')
              .select('id')
              .eq('user_id', userId)
              .eq('notification_type', 'matchday_recap')
              .eq('tournament_id', tournament.id)
              .eq('matchday', matchday)
              .eq('channel', 'email')
              .single()

            if (userLog) {
              totalSkipped++
              continue
            }

            // Préparer les données pour l'email
            const userMatchdayStats = matchdayRankingData.find(r => r.userId === userId)
            const userGeneralStats = generalRankingData.find(r => r.userId === userId)

            const matchdayRanking = matchdayRankingData
              .slice(0, 10)
              .map(r => ({
                rank: r.rank,
                username: r.username,
                points: r.points,
                isCurrentUser: r.userId === userId
              }))

            const generalRanking = generalRankingData
              .slice(0, 10)
              .map(r => ({
                rank: r.rank,
                username: r.username,
                totalPoints: r.totalPoints,
                isCurrentUser: r.userId === userId
              }))

            try {
              const result = await sendMatchdayRecapEmail(email, {
                username,
                tournamentName: tournament.name,
                tournamentSlug: tournament.slug,
                competitionName,
                matchdayNumber: matchday,
                userPointsGained: userMatchdayStats?.points || 0,
                matchdayRanking,
                generalRanking,
                userStats: {
                  exactScores: userMatchdayStats?.exactScores || 0,
                  correctResults: userMatchdayStats?.correctResults || 0,
                  matchdayRank: userMatchdayStats?.rank || 0,
                  generalRank: userGeneralStats?.rank || 0,
                  rankChange: userGeneralStats?.rankChange || 0
                }
              })

              // Logger le résultat
              await supabase.from('notification_logs').insert({
                user_id: userId,
                notification_type: 'matchday_recap',
                tournament_id: tournament.id,
                matchday,
                channel: 'email',
                status: result.success ? 'sent' : 'failed',
                sent_at: result.success ? new Date().toISOString() : null,
                error_message: result.error || null
              })

              if (result.success) {
                totalEmailsSent++
                console.log(`[DAY-RECAP] ✅ Email sent to ${username} for "${tournament.name}" J${matchday}`)
              } else {
                totalErrors++
                errors.push(`Failed to send to ${username}: ${result.error}`)
                console.error(`[DAY-RECAP] ❌ Failed to send to ${username}:`, result.error)
              }
            } catch (emailError: any) {
              totalErrors++
              errors.push(`Exception sending to ${username}: ${emailError.message}`)
              console.error(`[DAY-RECAP] ❌ Exception for ${username}:`, emailError.message)
            }
          }
        }
      } catch (tournamentError: any) {
        totalErrors++
        errors.push(`Tournament ${tournament.name}: ${tournamentError.message}`)
        console.error(`[DAY-RECAP] Error processing tournament "${tournament.name}":`, tournamentError)
      }
    }

    console.log(`[DAY-RECAP] Process completed: ${totalEmailsSent} sent, ${totalSkipped} skipped, ${totalErrors} errors`)

    return NextResponse.json({
      success: true,
      message: 'Day recap process completed',
      emailsSent: totalEmailsSent,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString()
    })

  } catch (error: any) {
    console.error('[DAY-RECAP] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Détecte les journées dont TOUS les matchs sont terminés (FINISHED ou AWARDED)
 */
async function getFinishedMatchdays(
  supabase: any,
  tournament: any,
  matchdaysInRange: number[],
  tournamentStartDate: Date | null,
  isCustom: boolean
): Promise<number[]> {
  const finishedMatchdays: number[] = []

  if (isCustom) {
    // Tournoi custom
    const { data: matchdaysData } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .in('matchday_number', matchdaysInRange)

    if (!matchdaysData) return []

    for (const md of matchdaysData) {
      const { data: matches } = await supabase
        .from('custom_competition_matches')
        .select('id, cached_utc_date, imported_match_id, imported_matches(status)')
        .eq('custom_matchday_id', md.id)

      if (!matches || matches.length === 0) continue

      // Filtrer par date de démarrage du tournoi
      const relevantMatches = tournamentStartDate
        ? matches.filter((m: any) => new Date(m.cached_utc_date) >= tournamentStartDate)
        : matches

      if (relevantMatches.length === 0) continue

      const allFinished = relevantMatches.every((m: any) => {
        const status = (m.imported_matches as any)?.status
        return status === 'FINISHED' || status === 'AWARDED'
      })

      if (allFinished) {
        finishedMatchdays.push(md.matchday_number)
      }
    }
  } else {
    // Tournoi standard
    for (const matchday of matchdaysInRange) {
      const { data: matches } = await supabase
        .from('imported_matches')
        .select('id, status, utc_date')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', matchday)

      if (!matches || matches.length === 0) continue

      // Filtrer par date de démarrage du tournoi
      const relevantMatches = tournamentStartDate
        ? matches.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
        : matches

      if (relevantMatches.length === 0) continue

      const allFinished = relevantMatches.every((m: any) =>
        m.status === 'FINISHED' || m.status === 'AWARDED'
      )

      if (allFinished) {
        finishedMatchdays.push(matchday)
      }
    }
  }

  return finishedMatchdays
}

/**
 * Calcule les classements de la journée ET le classement général
 */
interface RankingEntry {
  userId: string
  username: string
  rank: number
  points: number
  totalPoints: number
  exactScores: number
  correctResults: number
  rankChange: number
}

async function calculateMatchdayAndGeneralRankings(
  supabase: any,
  tournament: any,
  targetMatchday: number,
  allMatchdaysInRange: number[],
  participants: any[],
  pointsSettings: PointsSettings,
  tournamentStartDate: Date | null,
  isCustom: boolean
): Promise<{ matchdayRankingData: RankingEntry[], generalRankingData: RankingEntry[] }> {

  // Journées pour le classement général (toutes jusqu'à targetMatchday incluse)
  const generalMatchdays = allMatchdaysInRange.filter(md => md <= targetMatchday)
  // Journées pour le classement "avant cette journée" (pour calculer le rankChange)
  const previousMatchdays = allMatchdaysInRange.filter(md => md < targetMatchday)

  // Récupérer les matchs terminés pour les différentes ranges
  const allFinishedMatches = await getFinishedMatchesForMatchdays(
    supabase, tournament, generalMatchdays, tournamentStartDate, isCustom
  )
  const matchdayMatches = allFinishedMatches.filter(m => m.matchday === targetMatchday)

  // Récupérer les matchs bonus
  const { data: bonusMatches } = await supabase
    .from('tournament_bonus_matches')
    .select('match_id, matchday')
    .eq('tournament_id', tournament.id)
    .in('matchday', generalMatchdays)

  const bonusMatchIds = new Set(bonusMatches?.map((bm: any) => bm.match_id) || [])

  // Récupérer toutes les prédictions du tournoi
  const allMatchIds = allFinishedMatches.map(m => m.id)
  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('user_id, match_id, predicted_home_score, predicted_away_score, is_default_prediction')
    .eq('tournament_id', tournament.id)
    .in('match_id', allMatchIds.length > 0 ? allMatchIds : ['00000000-0000-0000-0000-000000000000'])

  const predictionsByUser = new Map<string, any[]>()
  for (const pred of (allPredictions || [])) {
    if (!predictionsByUser.has(pred.user_id)) {
      predictionsByUser.set(pred.user_id, [])
    }
    predictionsByUser.get(pred.user_id)!.push(pred)
  }

  // Calcul des stats par participant
  const matchdayRankingData: RankingEntry[] = []
  const generalRankingData: RankingEntry[] = []
  const previousRankingData: RankingEntry[] = []

  const finishedMatchesMap = new Map(allFinishedMatches.map(m => [m.id, m]))

  for (const participant of participants) {
    const userId = participant.user_id
    const username = (participant.profiles as any)?.username || 'Joueur'
    const predictions = predictionsByUser.get(userId) || []
    const predictionsMap = new Map(predictions.map(p => [p.match_id, p]))

    // --- Classement de la journée (uniquement matchdayMatches) ---
    let mdPoints = 0, mdExact = 0, mdCorrect = 0
    for (const match of matchdayMatches) {
      const pred = predictionsMap.get(match.id) || {
        predicted_home_score: 0, predicted_away_score: 0, is_default_prediction: true
      }
      const result = calculatePoints(
        { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
        { homeScore: match.home_score, awayScore: match.away_score },
        pointsSettings,
        bonusMatchIds.has(match.id),
        pred.is_default_prediction || false
      )
      mdPoints += result.points
      if (!pred.is_default_prediction) {
        if (result.isExactScore) mdExact++
        if (result.isCorrectResult) mdCorrect++
      }
    }

    matchdayRankingData.push({
      userId, username, rank: 0, points: mdPoints, totalPoints: 0,
      exactScores: mdExact, correctResults: mdCorrect, rankChange: 0
    })

    // --- Classement général (toutes journées jusqu'à targetMatchday) ---
    let genPoints = 0
    for (const match of allFinishedMatches) {
      const pred = predictionsMap.get(match.id) || {
        predicted_home_score: 0, predicted_away_score: 0, is_default_prediction: true
      }
      const result = calculatePoints(
        { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
        { homeScore: match.home_score, awayScore: match.away_score },
        pointsSettings,
        bonusMatchIds.has(match.id),
        pred.is_default_prediction || false
      )
      genPoints += result.points
    }

    generalRankingData.push({
      userId, username, rank: 0, points: 0, totalPoints: genPoints,
      exactScores: 0, correctResults: 0, rankChange: 0
    })

    // --- Classement précédent (pour calculer rankChange) ---
    if (previousMatchdays.length > 0) {
      let prevPoints = 0
      const previousMatches = allFinishedMatches.filter(m => m.matchday < targetMatchday)
      for (const match of previousMatches) {
        const pred = predictionsMap.get(match.id) || {
          predicted_home_score: 0, predicted_away_score: 0, is_default_prediction: true
        }
        const result = calculatePoints(
          { predictedHomeScore: pred.predicted_home_score, predictedAwayScore: pred.predicted_away_score },
          { homeScore: match.home_score, awayScore: match.away_score },
          pointsSettings,
          bonusMatchIds.has(match.id),
          pred.is_default_prediction || false
        )
        prevPoints += result.points
      }

      previousRankingData.push({
        userId, username, rank: 0, points: 0, totalPoints: prevPoints,
        exactScores: 0, correctResults: 0, rankChange: 0
      })
    }
  }

  // Trier et attribuer les rangs
  assignRanks(matchdayRankingData, 'points')
  assignRanks(generalRankingData, 'totalPoints')

  if (previousRankingData.length > 0) {
    assignRanks(previousRankingData, 'totalPoints')

    // Calculer le changement de rang
    const previousRankMap = new Map(previousRankingData.map(r => [r.userId, r.rank]))
    for (const entry of generalRankingData) {
      const prevRank = previousRankMap.get(entry.userId)
      if (prevRank !== undefined) {
        entry.rankChange = prevRank - entry.rank // positif = montée, négatif = descente
      }
    }
  }

  return { matchdayRankingData, generalRankingData }
}

/**
 * Trie et attribue les rangs (ex-aequo possible)
 */
function assignRanks(entries: RankingEntry[], sortField: 'points' | 'totalPoints') {
  entries.sort((a, b) => {
    const aVal = sortField === 'points' ? a.points : a.totalPoints
    const bVal = sortField === 'points' ? b.points : b.totalPoints
    if (bVal !== aVal) return bVal - aVal
    // Départage par scores exacts puis résultats corrects
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores
    return b.correctResults - a.correctResults
  })

  let currentRank = 1
  entries.forEach((entry, index) => {
    if (index > 0) {
      const prev = entries[index - 1]
      const prevVal = sortField === 'points' ? prev.points : prev.totalPoints
      const curVal = sortField === 'points' ? entry.points : entry.totalPoints
      if (curVal !== prevVal) {
        currentRank = index + 1
      }
    }
    entry.rank = currentRank
  })
}

/**
 * Récupère les matchs terminés pour un ensemble de journées
 */
async function getFinishedMatchesForMatchdays(
  supabase: any,
  tournament: any,
  matchdays: number[],
  tournamentStartDate: Date | null,
  isCustom: boolean
): Promise<Array<{ id: string, matchday: number, home_score: number, away_score: number, utc_date: string }>> {
  if (matchdays.length === 0) return []

  if (isCustom) {
    const { data: matchdaysData } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .in('matchday_number', matchdays)

    if (!matchdaysData || matchdaysData.length === 0) return []

    const matchdayIds = matchdaysData.map((md: any) => md.id)
    const matchdayNumberMap: Record<string, number> = {}
    matchdaysData.forEach((md: any) => { matchdayNumberMap[md.id] = md.matchday_number })

    const { data: customMatches } = await supabase
      .from('custom_competition_matches')
      .select('id, custom_matchday_id, football_data_match_id, cached_utc_date')
      .in('custom_matchday_id', matchdayIds)

    if (!customMatches) return []

    const footballDataIds = customMatches
      .map((m: any) => m.football_data_match_id)
      .filter((id: any) => id !== null)

    const { data: importedMatches } = await supabase
      .from('imported_matches')
      .select('id, football_data_match_id, home_score, away_score, status, utc_date')
      .in('football_data_match_id', footballDataIds)

    const importedMatchesMap: Record<number, any> = {}
    importedMatches?.forEach((im: any) => {
      importedMatchesMap[im.football_data_match_id] = im
    })

    const result = customMatches
      .map((cm: any) => {
        const im = importedMatchesMap[cm.football_data_match_id]
        return {
          id: im?.id || cm.id,
          matchday: matchdayNumberMap[cm.custom_matchday_id],
          utc_date: im?.utc_date || cm.cached_utc_date,
          home_score: im?.home_score ?? null,
          away_score: im?.away_score ?? null,
          status: im?.status || 'SCHEDULED'
        }
      })
      .filter((m: any) => m.home_score !== null && m.away_score !== null)

    return tournamentStartDate
      ? result.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
      : result
  } else {
    const { data: matches } = await supabase
      .from('imported_matches')
      .select('id, matchday, home_score, away_score, utc_date, status')
      .eq('competition_id', tournament.competition_id)
      .in('matchday', matchdays)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)

    const result = matches || []
    return tournamentStartDate
      ? result.filter((m: any) => new Date(m.utc_date) >= tournamentStartDate)
      : result
  }
}
