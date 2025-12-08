/**
 * Script pour corriger les journées d'un tournoi par son slug
 *
 * Corrige le tournoi "Free-Kick-2-Test" (VUTTFRBF)
 * - starting_matchday: 15 → 16
 * - ending_matchday: 24 → 25
 * - Résultat: 10 journées jouables (J16 à J25)
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Charger les variables d'environnement depuis .env.local
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fixTournamentBySlug(slug: string) {
  console.log('🔧 Recherche du tournoi avec le slug:', slug)
  console.log('='.repeat(60))

  // 1. Rechercher le tournoi par slug (partiel)
  const { data: tournaments, error: searchError } = await supabase
    .from('tournaments')
    .select('*')
    .ilike('slug', `%${slug}%`)

  if (searchError || !tournaments || tournaments.length === 0) {
    console.error('❌ Tournoi non trouvé avec le slug:', slug)
    return
  }

  if (tournaments.length > 1) {
    console.log('⚠️ Plusieurs tournois trouvés:')
    tournaments.forEach(t => console.log(`  - ${t.name} (${t.slug})`))
    console.log('Utilisation du premier...')
  }

  const tournament = tournaments[0]

  console.log('\n📊 Tournoi trouvé:')
  console.log(`  - ID: ${tournament.id}`)
  console.log(`  - Nom: ${tournament.name}`)
  console.log(`  - Slug: ${tournament.slug}`)
  console.log(`  - Type: ${tournament.tournament_type}`)
  console.log(`  - Status: ${tournament.status}`)
  console.log(`  - num_matchdays: ${tournament.num_matchdays}`)
  console.log(`  - starting_matchday: ${tournament.starting_matchday}`)
  console.log(`  - ending_matchday: ${tournament.ending_matchday}`)
  console.log(`  - start_date: ${tournament.start_date}`)

  if (!tournament.competition_id) {
    console.error('❌ Ce tournoi n\'a pas de competition_id')
    return
  }

  // 2. Trouver la première journée jouable au moment du lancement
  const startDate = tournament.start_date ? new Date(tournament.start_date) : new Date()
  const closingBuffer = 30 * 60 * 1000 // 30 minutes
  const closingTime = new Date(startDate.getTime() + closingBuffer).toISOString()

  const { data: allMatches } = await supabase
    .from('imported_matches')
    .select('matchday, utc_date')
    .eq('competition_id', tournament.competition_id)
    .order('matchday', { ascending: true })

  if (!allMatches || allMatches.length === 0) {
    console.error('❌ Aucun match trouvé')
    return
  }

  // Grouper par journée
  const matchesByMatchday: Record<number, string[]> = {}
  allMatches.forEach(match => {
    if (!matchesByMatchday[match.matchday]) {
      matchesByMatchday[match.matchday] = []
    }
    matchesByMatchday[match.matchday].push(match.utc_date)
  })

  const sortedMatchdays = Object.keys(matchesByMatchday).map(Number).sort((a, b) => a - b)
  let firstPlayableMatchday: number | null = null

  console.log('\n🔍 Analyse des journées (autour du lancement):')
  for (const matchday of sortedMatchdays) {
    const matchDates = matchesByMatchday[matchday]
    const firstMatchDate = matchDates.sort()[0]
    const isPlayable = firstMatchDate > closingTime

    // Afficher les journées proches
    if (matchday >= 14 && matchday <= 18) {
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
  const actualMatchdays = Math.min(numMatchdays, availableMatchdays)

  const newStartingMatchday = firstPlayableMatchday
  const newEndingMatchday = newStartingMatchday + actualMatchdays - 1
  const newSnapshot = Array.from({ length: actualMatchdays }, (_, i) => newStartingMatchday + i)

  console.log('\n📐 Correction à appliquer:')
  console.log(`  - starting_matchday: ${tournament.starting_matchday} → ${newStartingMatchday}`)
  console.log(`  - ending_matchday: ${tournament.ending_matchday} → ${newEndingMatchday}`)
  console.log(`  - Journées: J${newStartingMatchday} à J${newEndingMatchday} (${actualMatchdays} journées)`)

  if (tournament.starting_matchday === newStartingMatchday && tournament.ending_matchday === newEndingMatchday) {
    console.log('\n✅ Le tournoi a déjà les bonnes valeurs!')
    return
  }

  // 4. Appliquer la correction
  console.log('\n💾 Application...')

  const { error: updateError } = await supabase
    .from('tournaments')
    .update({
      starting_matchday: newStartingMatchday,
      ending_matchday: newEndingMatchday,
      actual_matchdays: actualMatchdays,
      matchday_snapshot: newSnapshot,
      updated_at: new Date().toISOString()
    })
    .eq('id', tournament.id)

  if (updateError) {
    console.error('❌ Erreur:', updateError.message)
    return
  }

  console.log('\n✅ Tournoi corrigé!')
  console.log(`  → ${actualMatchdays} journées de J${newStartingMatchday} à J${newEndingMatchday}`)
}

// Slug passé en argument ou par défaut VUTTFRBF
const slug = process.argv[2] || 'VUTTFRBF'
fixTournamentBySlug(slug)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
