import { createClient } from '@/lib/supabase/server'

// Types simplifiés pour tournament-duration
type Tournament = {
  id: string
  custom_competition_id: string | null
  competition_id: number | null
  ending_matchday: number
  starting_matchday: number | null
  ending_date: string | null
}

type ImportedMatch = {
  id: string
  competition_id: number
  matchday: number
  stage: string | null
  utc_date: string | null
  status: string | null
}

type CustomMatch = {
  cached_utc_date: string | null
  custom_matchday_id: string
}

type CustomMatchday = {
  id: string
  matchday_number: number
  custom_competition_id: string
}

/**
 * Résultat du recalcul de la durée d'un tournoi
 */
export interface TournamentDurationResult {
  ending_date: string | null
  ending_matchday: number
  estimation_used: boolean
  estimation_details?: string
}

/**
 * Options pour le recalcul de la durée
 */
export interface RecalculateOptions {
  reason: string
  previous_ending_matchday?: number
  previous_ending_date?: string | null
}

/**
 * Recalcule la ending_date d'un tournoi en fonction de ses matchs
 * et met à jour la base de données avec un événement de tracking
 */
export async function recalculateTournamentEndingDate(
  tournamentId: string,
  options: RecalculateOptions
): Promise<TournamentDurationResult> {
  const supabase = await createClient()

  // Récupérer les informations du tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    throw new Error(`Tournoi ${tournamentId} non trouvé`)
  }

  let result: TournamentDurationResult

  // Déterminer si c'est une compétition custom ou importée
  if (tournament.custom_competition_id) {
    result = await calculateCustomCompetitionEndingDate(
      supabase,
      tournament.custom_competition_id,
      tournament.ending_matchday
    )
  } else if (tournament.competition_id) {
    result = await calculateImportedCompetitionEndingDate(
      supabase,
      tournament.competition_id,
      tournament.ending_matchday,
      tournament.starting_matchday || 1
    )
  } else {
    throw new Error('Tournoi sans compétition associée')
  }

  // Mettre à jour le tournoi avec la nouvelle ending_date
  const { error: updateError } = await supabase
    .from('tournaments')
    .update({ ending_date: result.ending_date })
    .eq('id', tournamentId)

  if (updateError) {
    console.error('Erreur lors de la mise à jour de ending_date:', updateError)
  }

  // Enregistrer l'événement dans la table de tracking
  await logDurationEvent(supabase, tournamentId, {
    event_type: 'recalculation',
    previous_ending_matchday: options.previous_ending_matchday ?? tournament.ending_matchday,
    new_ending_matchday: result.ending_matchday,
    previous_ending_date: options.previous_ending_date ?? tournament.ending_date,
    new_ending_date: result.ending_date,
    reason: options.reason,
    estimation_used: result.estimation_used,
    estimation_details: result.estimation_details
  })

  return result
}

/**
 * Calcule la ending_date pour une compétition custom
 */
async function calculateCustomCompetitionEndingDate(
  supabase: any,
  customCompetitionId: string,
  endingMatchday: number
): Promise<TournamentDurationResult> {
  // Récupérer la dernière journée
  const { data: lastMatchday } = await supabase
    .from('custom_competition_matchdays')
    .select('id')
    .eq('custom_competition_id', customCompetitionId)
    .eq('matchday_number', endingMatchday)
    .single()

  if (!lastMatchday) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Journée finale non trouvée'
    }
  }

  // Récupérer le dernier match de cette journée avec une date définie
  const { data: lastMatch } = await supabase
    .from('custom_competition_matches')
    .select('cached_utc_date')
    .eq('custom_matchday_id', lastMatchday.id)
    .not('cached_utc_date', 'is', null)
    .order('cached_utc_date', { ascending: false })
    .limit(1)
    .single()

  if (lastMatch?.cached_utc_date) {
    return {
      ending_date: lastMatch.cached_utc_date,
      ending_matchday: endingMatchday,
      estimation_used: false
    }
  }

  // Pas de date trouvée : estimation basée sur les journées précédentes
  const estimation = await estimateCustomCompetitionEndingDate(
    supabase,
    customCompetitionId,
    endingMatchday
  )

  return estimation
}

/**
 * Calcule la ending_date pour une compétition importée
 */
async function calculateImportedCompetitionEndingDate(
  supabase: any,
  competitionId: number,
  endingMatchday: number,
  startingMatchday: number
): Promise<TournamentDurationResult> {
  // Récupérer UNIQUEMENT les matchs dans la plage choisie par l'utilisateur (starting → ending)
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', competitionId)
    .gte('matchday', startingMatchday)
    .lte('matchday', endingMatchday)
    .order('matchday', { ascending: true })
    .order('utc_date', { ascending: true })

  if (!matches || matches.length === 0) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Aucun match trouvé pour cette compétition'
    }
  }

  // Détecter si c'est une compétition à élimination
  const isKnockout = isKnockoutCompetition(matches)

  if (isKnockout) {
    return await calculateKnockoutEndingDate(supabase, competitionId, endingMatchday, startingMatchday, matches)
  } else {
    return await calculateLeagueEndingDate(supabase, competitionId, endingMatchday, startingMatchday, matches)
  }
}

/**
 * Détermine si une compétition est à élimination directe
 */
function isKnockoutCompetition(matches: ImportedMatch[]): boolean {
  const knockoutStages = [
    'LAST_32',
    'ROUND_OF_16',
    'QUARTER_FINALS',
    'SEMI_FINALS',
    'FINAL',
    'THIRD_PLACE',
    'PLAYOFFS'
  ]

  return matches.some(m => m.stage && knockoutStages.includes(m.stage))
}

/**
 * Calcule la ending_date pour une compétition de type championnat (league)
 */
async function calculateLeagueEndingDate(
  supabase: any,
  competitionId: number,
  endingMatchday: number,
  startingMatchday: number,
  matches: ImportedMatch[]
): Promise<TournamentDurationResult> {
  // Récupérer le dernier match de la dernière journée avec une date définie
  const lastMatchdayMatches = matches.filter(m => m.matchday === endingMatchday)

  const matchesWithDate = lastMatchdayMatches
    .filter(m => m.utc_date !== null)
    .sort((a, b) => new Date(b.utc_date!).getTime() - new Date(a.utc_date!).getTime())

  if (matchesWithDate.length > 0) {
    return {
      ending_date: matchesWithDate[0].utc_date!,
      ending_matchday: endingMatchday,
      estimation_used: false
    }
  }

  // Si aucune date n'est disponible, estimer
  return await estimateLeagueEndingDate(supabase, competitionId, endingMatchday, startingMatchday, matches)
}

/**
 * Calcule la ending_date pour une compétition à élimination directe
 */
async function calculateKnockoutEndingDate(
  supabase: any,
  competitionId: number,
  endingMatchday: number,
  startingMatchday: number,
  matches: ImportedMatch[]
): Promise<TournamentDurationResult> {
  // Récupérer tous les matchs jusqu'à la journée finale (y compris ceux avec équipes TBD)
  const matchesUpToEnd = matches.filter(m => m.matchday <= endingMatchday)

  // Vérifier si tous les matchs ont des dates
  const matchesWithDate = matchesUpToEnd.filter(m => m.utc_date !== null)

  if (matchesWithDate.length === matchesUpToEnd.length) {
    // Tous les matchs ont des dates : prendre le dernier
    const lastMatch = matchesWithDate
      .sort((a, b) => new Date(b.utc_date!).getTime() - new Date(a.utc_date!).getTime())[0]

    return {
      ending_date: lastMatch.utc_date!,
      ending_matchday: endingMatchday,
      estimation_used: false
    }
  }

  // Certains matchs n'ont pas de date (TBD) : estimer
  return await estimateKnockoutEndingDate(supabase, competitionId, endingMatchday, startingMatchday, matches)
}

/**
 * Estime la ending_date pour une compétition custom sans dates
 */
async function estimateCustomCompetitionEndingDate(
  supabase: any,
  customCompetitionId: string,
  endingMatchday: number
): Promise<TournamentDurationResult> {
  // Récupérer toutes les journées avec des dates
  const { data: matchdays } = await supabase
    .from('custom_competition_matchdays')
    .select(`
      id,
      matchday_number,
      custom_competition_matches (cached_utc_date)
    `)
    .eq('custom_competition_id', customCompetitionId)
    .lte('matchday_number', endingMatchday)
    .order('matchday_number', { ascending: true })

  if (!matchdays || matchdays.length === 0) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Aucune journée trouvée'
    }
  }

  // Calculer l'intervalle moyen entre les journées
  const intervals: number[] = []
  let lastDate: Date | null = null

  for (const matchday of matchdays) {
    const matches = matchday.custom_competition_matches as unknown as CustomMatch[]
    const matchesWithDate = matches.filter(m => m.cached_utc_date !== null)

    if (matchesWithDate.length > 0) {
      const latestInMatchday = matchesWithDate
        .map(m => new Date(m.cached_utc_date!))
        .sort((a, b) => b.getTime() - a.getTime())[0]

      if (lastDate) {
        const daysDiff = (latestInMatchday.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        intervals.push(daysDiff)
      }

      lastDate = latestInMatchday
    }
  }

  if (intervals.length === 0 || !lastDate) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Pas assez de données pour estimer'
    }
  }

  // Calculer l'intervalle moyen
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

  // Calculer combien de journées il reste à estimer
  const lastKnownMatchday = matchdays[matchdays.length - 1].matchday_number
  const remainingMatchdays = endingMatchday - lastKnownMatchday

  // Estimer la date finale
  const estimatedDate = new Date(lastDate)
  estimatedDate.setDate(estimatedDate.getDate() + avgInterval * remainingMatchdays)

  return {
    ending_date: estimatedDate.toISOString(),
    ending_matchday: endingMatchday,
    estimation_used: true,
    estimation_details: `Estimation basée sur ${intervals.length} intervalles (moyenne: ${avgInterval.toFixed(1)} jours)`
  }
}

/**
 * Estime la ending_date pour un championnat sans dates futures
 */
async function estimateLeagueEndingDate(
  supabase: any,
  competitionId: number,
  endingMatchday: number,
  startingMatchday: number,
  matches: ImportedMatch[]
): Promise<TournamentDurationResult> {
  // Calculer l'intervalle moyen entre les journées avec des dates
  const matchesByMatchday = new Map<number, Date>()

  for (const match of matches) {
    if (match.utc_date) {
      const matchDate = new Date(match.utc_date)
      const existing = matchesByMatchday.get(match.matchday)

      if (!existing || matchDate > existing) {
        matchesByMatchday.set(match.matchday, matchDate)
      }
    }
  }

  const sortedMatchdays = Array.from(matchesByMatchday.entries())
    .sort((a, b) => a[0] - b[0])

  if (sortedMatchdays.length < 2) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Pas assez de journées avec dates pour estimer'
    }
  }

  // Calculer les intervalles entre journées consécutives
  const intervals: number[] = []
  for (let i = 1; i < sortedMatchdays.length; i++) {
    const daysDiff = (sortedMatchdays[i][1].getTime() - sortedMatchdays[i - 1][1].getTime()) / (1000 * 60 * 60 * 24)
    intervals.push(daysDiff)
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

  // Dernière journée connue
  const lastKnownMatchday = sortedMatchdays[sortedMatchdays.length - 1][0]
  const lastKnownDate = sortedMatchdays[sortedMatchdays.length - 1][1]

  // Calculer combien de journées restent
  const remainingMatchdays = endingMatchday - lastKnownMatchday

  // Estimer la date finale
  const estimatedDate = new Date(lastKnownDate)
  estimatedDate.setDate(estimatedDate.getDate() + avgInterval * remainingMatchdays)

  return {
    ending_date: estimatedDate.toISOString(),
    ending_matchday: endingMatchday,
    estimation_used: true,
    estimation_details: `Estimation basée sur ${intervals.length} intervalles (moyenne: ${avgInterval.toFixed(1)} jours/journée)`
  }
}

/**
 * Estime la ending_date pour une compétition à élimination avec matchs TBD
 */
async function estimateKnockoutEndingDate(
  supabase: any,
  competitionId: number,
  endingMatchday: number,
  startingMatchday: number,
  matches: ImportedMatch[]
): Promise<TournamentDurationResult> {
  // Grouper les matchs par stage
  const matchesByStage = new Map<string, ImportedMatch[]>()

  for (const match of matches) {
    if (match.stage) {
      if (!matchesByStage.has(match.stage)) {
        matchesByStage.set(match.stage, [])
      }
      matchesByStage.get(match.stage)!.push(match)
    }
  }

  // Identifier les stages avec toutes leurs dates
  const stageWithDates = new Map<string, { firstDate: Date; lastDate: Date; matchday: number }>()

  for (const [stage, stageMatches] of matchesByStage.entries()) {
    const matchesWithDate = stageMatches.filter(m => m.utc_date !== null)

    if (matchesWithDate.length === stageMatches.length) {
      // Tous les matchs du stage ont des dates
      const dates = matchesWithDate.map(m => new Date(m.utc_date!))
      const firstDate = dates.sort((a, b) => a.getTime() - b.getTime())[0]
      const lastDate = dates.sort((a, b) => b.getTime() - a.getTime())[0]

      stageWithDates.set(stage, {
        firstDate,
        lastDate,
        matchday: stageMatches[0].matchday
      })
    }
  }

  if (stageWithDates.size < 2) {
    return {
      ending_date: null,
      ending_matchday: endingMatchday,
      estimation_used: true,
      estimation_details: 'Pas assez de stages complets pour estimer'
    }
  }

  // Calculer l'intervalle moyen entre les stages
  const sortedStages = Array.from(stageWithDates.entries())
    .sort((a, b) => a[1].matchday - b[1].matchday)

  const intervals: number[] = []
  for (let i = 1; i < sortedStages.length; i++) {
    const daysDiff = (sortedStages[i][1].firstDate.getTime() - sortedStages[i - 1][1].lastDate.getTime()) / (1000 * 60 * 60 * 24)
    intervals.push(daysDiff)
  }

  const avgIntervalBetweenStages = intervals.reduce((a, b) => a + b, 0) / intervals.length

  // Dernière date connue
  const lastKnownStage = sortedStages[sortedStages.length - 1]
  const lastKnownDate = lastKnownStage[1].lastDate
  const lastKnownMatchday = lastKnownStage[1].matchday

  // Compter les stages restants
  const remainingMatchdays = endingMatchday - lastKnownMatchday
  const stagesPerMatchday = 1 // Approximation : 1 stage par journée (ou 2 si aller-retour)

  // Estimer en fonction du nombre de matchdays restantes
  const estimatedDate = new Date(lastKnownDate)
  estimatedDate.setDate(estimatedDate.getDate() + avgIntervalBetweenStages * remainingMatchdays)

  return {
    ending_date: estimatedDate.toISOString(),
    ending_matchday: endingMatchday,
    estimation_used: true,
    estimation_details: `Estimation knockout basée sur ${intervals.length} intervalles entre stages (moyenne: ${avgIntervalBetweenStages.toFixed(1)} jours)`
  }
}

/**
 * Enregistre un événement de modification de durée dans la table de tracking
 */
async function logDurationEvent(
  supabase: any,
  tournamentId: string,
  event: {
    event_type: string
    previous_ending_matchday: number
    new_ending_matchday: number
    previous_ending_date: string | null
    new_ending_date: string | null
    reason: string
    estimation_used?: boolean
    estimation_details?: string
  }
): Promise<void> {
  const { error } = await supabase.from('tournament_duration_events').insert({
    tournament_id: tournamentId,
    event_type: event.event_type,
    previous_ending_matchday: event.previous_ending_matchday,
    new_ending_matchday: event.new_ending_matchday,
    previous_ending_date: event.previous_ending_date,
    new_ending_date: event.new_ending_date,
    reason: event.reason,
    metadata: {
      estimation_used: event.estimation_used,
      estimation_details: event.estimation_details
    }
  })

  if (error) {
    console.error('Erreur lors de l\'enregistrement de l\'événement de durée:', error)
  }
}
