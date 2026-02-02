import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

config({ path: join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Version simplifiée de recalculateTournamentEndingDate pour scripts
 */
async function recalculateEndingDate(tournamentId, tournament) {
  console.log(`   Calcul pour tournoi: ${tournament.name}`)
  console.log(`   Competition ID: ${tournament.competition_id || tournament.custom_competition_id}`)
  console.log(`   Range: J${tournament.starting_matchday} → J${tournament.ending_matchday}`)

  let endingDate = null
  let estimationUsed = false
  let estimationDetails = ''

  try {
    if (tournament.custom_competition_id) {
      // Compétition custom
      const result = await calculateCustomCompetitionEndingDate(
        tournament.custom_competition_id,
        tournament.ending_matchday
      )
      endingDate = result.endingDate
      estimationUsed = result.estimationUsed
      estimationDetails = result.estimationDetails

    } else if (tournament.competition_id) {
      // Compétition importée
      const result = await calculateImportedCompetitionEndingDate(
        tournament.competition_id,
        tournament.ending_matchday,
        tournament.starting_matchday
      )
      endingDate = result.endingDate
      estimationUsed = result.estimationUsed
      estimationDetails = result.estimationDetails
    }

    if (endingDate) {
      // Mettre à jour le tournoi
      const { error: updateError } = await supabase
        .from('tournaments')
        .update({ ending_date: endingDate })
        .eq('id', tournamentId)

      if (updateError) {
        console.error(`   ❌ Erreur de mise à jour: ${updateError.message}`)
        return false
      }

      // Logger l'événement
      await supabase.from('tournament_duration_events').insert({
        tournament_id: tournamentId,
        event_type: 'recalculation',
        previous_ending_matchday: tournament.ending_matchday,
        new_ending_matchday: tournament.ending_matchday,
        previous_ending_date: tournament.ending_date,
        new_ending_date: endingDate,
        reason: 'Script de correction - recalcul ending_date manquante',
        metadata: {
          estimation_used: estimationUsed,
          estimation_details: estimationDetails
        }
      })

      console.log(`   ✅ Ending date calculée: ${new Date(endingDate).toLocaleString('fr-FR')}`)
      if (estimationUsed) {
        console.log(`   ℹ️  ${estimationDetails}`)
      }
      return true
    } else {
      console.log(`   ⚠️  Impossible de calculer la ending_date`)
      return false
    }

  } catch (error) {
    console.error(`   ❌ Erreur: ${error.message}`)
    return false
  }
}

async function calculateCustomCompetitionEndingDate(customCompetitionId, endingMatchday) {
  // Récupérer toutes les journées jusqu'à la fin
  const { data: matchdays } = await supabase
    .from('custom_competition_matchdays')
    .select('id, matchday_number')
    .eq('custom_competition_id', customCompetitionId)
    .lte('matchday_number', endingMatchday)
    .order('matchday_number', { ascending: false })

  if (!matchdays || matchdays.length === 0) {
    return { endingDate: null, estimationUsed: true, estimationDetails: 'Aucune journée trouvée' }
  }

  const matchdayIds = matchdays.map(md => md.id)

  // Récupérer tous les matchs avec dates
  const { data: matches } = await supabase
    .from('custom_competition_matches')
    .select('custom_matchday_id, cached_utc_date')
    .in('custom_matchday_id', matchdayIds)
    .not('cached_utc_date', 'is', null)
    .order('cached_utc_date', { ascending: false })

  if (!matches || matches.length === 0) {
    return { endingDate: null, estimationUsed: true, estimationDetails: 'Aucun match avec date trouvé' }
  }

  // Trouver le dernier match de la dernière journée avec des matchs
  // Créer un map matchday_id -> matchday_number
  const matchdayMap = new Map(matchdays.map(md => [md.id, md.matchday_number]))

  // Trier les matchs par journée puis par date
  const sortedMatches = matches
    .map(m => ({ ...m, matchday_number: matchdayMap.get(m.custom_matchday_id) }))
    .sort((a, b) => {
      if (b.matchday_number !== a.matchday_number) {
        return b.matchday_number - a.matchday_number
      }
      return new Date(b.cached_utc_date).getTime() - new Date(a.cached_utc_date).getTime()
    })

  if (sortedMatches.length > 0) {
    return {
      endingDate: sortedMatches[0].cached_utc_date,
      estimationUsed: false,
      estimationDetails: ''
    }
  }

  return { endingDate: null, estimationUsed: true, estimationDetails: 'Aucun match avec date trouvé' }
}

async function calculateImportedCompetitionEndingDate(competitionId, endingMatchday, startingMatchday) {
  // Récupérer UNIQUEMENT les matchs dans la plage choisie (starting → ending)
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('*')
    .eq('competition_id', competitionId)
    .gte('matchday', startingMatchday || 1)
    .lte('matchday', endingMatchday)
    .order('matchday', { ascending: false })
    .order('utc_date', { ascending: false })

  if (!matches || matches.length === 0) {
    return { endingDate: null, estimationUsed: true, estimationDetails: 'Aucun match trouvé' }
  }

  // Détecter si c'est une compétition à élimination
  const knockoutStages = ['LAST_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE', 'PLAYOFFS']
  const hasKnockoutStages = matches.some(m => m.stage && knockoutStages.includes(m.stage))

  if (hasKnockoutStages) {
    // Compétition à élimination : on cherche le dernier match de la dernière journée
    // en prenant en compte les matchs même avec teams TBD
    const matchesWithDate = matches.filter(m => m.utc_date !== null)

    if (matchesWithDate.length > 0) {
      // Trier par matchday desc puis par date desc
      const sorted = matchesWithDate.sort((a, b) => {
        if (b.matchday !== a.matchday) {
          return b.matchday - a.matchday
        }
        return new Date(b.utc_date).getTime() - new Date(a.utc_date).getTime()
      })

      return {
        endingDate: sorted[0].utc_date,
        estimationUsed: false,
        estimationDetails: `Compétition à élimination - dernier match J${sorted[0].matchday}`
      }
    }

    // Pas de dates : on ne peut pas estimer pour le knockout
    return {
      endingDate: null,
      estimationUsed: true,
      estimationDetails: 'Compétition à élimination - dates futures non disponibles'
    }
  }

  // Compétition de championnat : chercher le dernier match de la dernière journée
  const lastMatchdayMatches = matches.filter(m => m.matchday === endingMatchday && m.utc_date !== null)

  if (lastMatchdayMatches.length > 0) {
    const sorted = lastMatchdayMatches.sort((a, b) =>
      new Date(b.utc_date).getTime() - new Date(a.utc_date).getTime()
    )
    return {
      endingDate: sorted[0].utc_date,
      estimationUsed: false,
      estimationDetails: ''
    }
  }

  // Pas de date trouvée : estimation
  const matchesWithDate = matches.filter(m => m.utc_date !== null)
  if (matchesWithDate.length < 2) {
    return {
      endingDate: null,
      estimationUsed: true,
      estimationDetails: 'Pas assez de matchs avec dates pour estimer'
    }
  }

  // Calculer intervalle moyen entre journées
  const matchdayDates = new Map()
  for (const match of matchesWithDate) {
    const matchDate = new Date(match.utc_date)
    const existing = matchdayDates.get(match.matchday)
    if (!existing || matchDate > existing) {
      matchdayDates.set(match.matchday, matchDate)
    }
  }

  const sortedMatchdays = Array.from(matchdayDates.entries())
    .sort((a, b) => a[0] - b[0])

  if (sortedMatchdays.length < 2) {
    return {
      endingDate: null,
      estimationUsed: true,
      estimationDetails: 'Pas assez de journées pour estimer'
    }
  }

  const intervals = []
  for (let i = 1; i < sortedMatchdays.length; i++) {
    const daysDiff = (sortedMatchdays[i][1].getTime() - sortedMatchdays[i - 1][1].getTime()) / (1000 * 60 * 60 * 24)
    intervals.push(daysDiff)
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

  const lastKnownMatchday = sortedMatchdays[sortedMatchdays.length - 1][0]
  const lastKnownDate = sortedMatchdays[sortedMatchdays.length - 1][1]
  const remainingMatchdays = endingMatchday - lastKnownMatchday

  const estimatedDate = new Date(lastKnownDate)
  estimatedDate.setDate(estimatedDate.getDate() + avgInterval * remainingMatchdays)

  return {
    endingDate: estimatedDate.toISOString(),
    estimationUsed: true,
    estimationDetails: `Estimation basée sur ${intervals.length} intervalles (moyenne: ${avgInterval.toFixed(1)} jours/journée)`
  }
}

async function forceRecalculate() {
  console.log('🔄 RECALCUL FORCÉ DES ENDING_DATE\n')

  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('status', 'active')
    .is('ending_date', null)

  if (error) {
    console.error('❌ Erreur:', error)
    return
  }

  if (!tournaments || tournaments.length === 0) {
    console.log('✅ Aucun tournoi sans ending_date')
    return
  }

  console.log(`📊 ${tournaments.length} tournoi(s) à recalculer\n`)

  let successCount = 0
  let failCount = 0

  for (const tournament of tournaments) {
    console.log(`\n🔄 Traitement: ${tournament.name}`)
    const success = await recalculateEndingDate(tournament.id, tournament)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log('\n' + '─'.repeat(80))
  console.log(`\n✅ Succès: ${successCount}`)
  console.log(`❌ Échecs: ${failCount}`)
  console.log('\n✅ Recalcul terminé!')
}

forceRecalculate()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erreur fatale:', err)
    process.exit(1)
  })
