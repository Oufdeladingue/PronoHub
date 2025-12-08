/**
 * Script pour corriger les journées d'un tournoi existant
 *
 * Usage: npx tsx scripts/fix-tournament-matchdays.ts <tournament_id>
 *
 * Ce script :
 * 1. Récupère le tournoi et ses infos
 * 2. Recalcule le starting_matchday basé sur la première journée COMPLÈTEMENT jouable au moment du lancement
 * 3. Met à jour ending_matchday pour avoir le bon nombre de journées (X journées demandées)
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  console.log('Assurez-vous que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définies')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixTournamentMatchdays(tournamentId: string) {
  console.log('🔧 Correction des journées du tournoi:', tournamentId)
  console.log('='.repeat(60))

  // 1. Récupérer le tournoi
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    console.error('❌ Tournoi non trouvé:', tournamentError?.message)
    return
  }

  console.log('\n📊 État actuel du tournoi:')
  console.log(`  - Nom: ${tournament.name}`)
  console.log(`  - Type: ${tournament.tournament_type}`)
  console.log(`  - Status: ${tournament.status}`)
  console.log(`  - num_matchdays: ${tournament.num_matchdays}`)
  console.log(`  - starting_matchday: ${tournament.starting_matchday}`)
  console.log(`  - ending_matchday: ${tournament.ending_matchday}`)
  console.log(`  - start_date: ${tournament.start_date}`)
  console.log(`  - competition_id: ${tournament.competition_id}`)

  if (!tournament.competition_id) {
    console.error('❌ Ce tournoi n\'a pas de competition_id (peut-être une compétition custom)')
    return
  }

  // 2. Trouver la première journée COMPLÈTEMENT jouable au moment du lancement
  const startDate = tournament.start_date ? new Date(tournament.start_date) : new Date()
  const closingBuffer = 30 * 60 * 1000 // 30 minutes
  const closingTime = new Date(startDate.getTime() + closingBuffer).toISOString()

  // Récupérer tous les matchs de la compétition
  const { data: allMatches } = await supabase
    .from('imported_matches')
    .select('matchday, utc_date')
    .eq('competition_id', tournament.competition_id)
    .order('matchday', { ascending: true })

  if (!allMatches || allMatches.length === 0) {
    console.error('❌ Aucun match trouvé pour cette compétition')
    return
  }

  // Grouper les matchs par journée
  const matchesByMatchday: Record<number, string[]> = {}
  allMatches.forEach(match => {
    if (!matchesByMatchday[match.matchday]) {
      matchesByMatchday[match.matchday] = []
    }
    matchesByMatchday[match.matchday].push(match.utc_date)
  })

  // Trouver la première journée où le PREMIER match n'est pas encore clôturé
  const sortedMatchdays = Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b)
  let firstPlayableMatchday: number | null = null

  console.log('\n🔍 Analyse des journées:')
  for (const matchday of sortedMatchdays) {
    const matchDates = matchesByMatchday[matchday]
    const firstMatchDate = matchDates.sort()[0]
    const isPlayable = firstMatchDate > closingTime

    if (matchday >= (tournament.starting_matchday || 1) - 2 && matchday <= (tournament.starting_matchday || 1) + 2) {
      console.log(`  J${matchday}: Premier match ${firstMatchDate.substring(0, 16)} - ${isPlayable ? '✅ Jouable' : '❌ Clôturé'}`)
    }

    if (isPlayable && !firstPlayableMatchday) {
      firstPlayableMatchday = matchday
    }
  }

  if (!firstPlayableMatchday) {
    console.error('❌ Aucune journée jouable trouvée')
    return
  }

  // 3. Calculer les nouvelles valeurs
  const numMatchdays = tournament.num_matchdays || 10
  const maxMatchday = sortedMatchdays[sortedMatchdays.length - 1]
  const availableMatchdays = maxMatchday - firstPlayableMatchday + 1

  // Vérifier si on a assez de journées
  const actualMatchdays = Math.min(numMatchdays, availableMatchdays)
  const newStartingMatchday = firstPlayableMatchday
  const newEndingMatchday = newStartingMatchday + actualMatchdays - 1

  // Générer le nouveau snapshot
  const newSnapshot = Array.from(
    { length: actualMatchdays },
    (_, i) => newStartingMatchday + i
  )

  console.log('\n📐 Valeurs calculées:')
  console.log(`  - Date de lancement: ${startDate.toISOString()}`)
  console.log(`  - Première journée jouable: J${firstPlayableMatchday}`)
  console.log(`  - Journées demandées: ${numMatchdays}`)
  console.log(`  - Journées disponibles: ${availableMatchdays}`)
  console.log(`  - Journées effectives: ${actualMatchdays}`)
  console.log(`  - Nouveau starting_matchday: ${newStartingMatchday}`)
  console.log(`  - Nouveau ending_matchday: ${newEndingMatchday}`)
  console.log(`  - Snapshot: [${newSnapshot.join(', ')}]`)

  // 4. Vérifier si une correction est nécessaire
  if (tournament.starting_matchday === newStartingMatchday && tournament.ending_matchday === newEndingMatchday) {
    console.log('\n✅ Le tournoi a déjà les bonnes valeurs, aucune correction nécessaire')
    return
  }

  console.log('\n🔄 Différences détectées:')
  if (tournament.starting_matchday !== newStartingMatchday) {
    console.log(`  - starting_matchday: ${tournament.starting_matchday} → ${newStartingMatchday}`)
  }
  if (tournament.ending_matchday !== newEndingMatchday) {
    console.log(`  - ending_matchday: ${tournament.ending_matchday} → ${newEndingMatchday}`)
  }

  // 5. Appliquer la correction
  console.log('\n💾 Application des corrections...')

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      starting_matchday: newStartingMatchday,
      ending_matchday: newEndingMatchday,
      actual_matchdays: actualMatchdays,
      matchday_snapshot: newSnapshot,
      updated_at: new Date().toISOString()
    })
    .eq('id', tournamentId)

  if (updateError) {
    console.error('❌ Erreur lors de la mise à jour:', updateError.message)
    return
  }

  console.log('\n✅ Tournoi corrigé avec succès!')
  console.log(`  - Le tournoi contient maintenant ${actualMatchdays} journées`)
  console.log(`  - De la journée J${newStartingMatchday} à la journée J${newEndingMatchday}`)

  if (actualMatchdays < numMatchdays) {
    console.log(`\n⚠️  Note: Le tournoi a ${actualMatchdays} journées au lieu de ${numMatchdays} demandées`)
    console.log(`    car il n'y avait que ${availableMatchdays} journées disponibles au moment du lancement`)
  }
}

// Récupérer l'ID du tournoi depuis les arguments
const tournamentId = process.argv[2]

if (!tournamentId) {
  console.log('Usage: npx tsx scripts/fix-tournament-matchdays.ts <tournament_id>')
  console.log('')
  console.log('Exemple: npx tsx scripts/fix-tournament-matchdays.ts 123e4567-e89b-12d3-a456-426614174000')
  process.exit(1)
}

fixTournamentMatchdays(tournamentId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erreur:', err)
    process.exit(1)
  })
