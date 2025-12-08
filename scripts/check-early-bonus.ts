/**
 * Script pour vérifier le calcul de la prime d'avant-match
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

async function checkEarlyBonus(tournamentSlug: string) {
  console.log('🔍 Vérification de la prime d\'avant-match pour:', tournamentSlug)
  console.log('='.repeat(60))

  // 1. Récupérer le tournoi
  const { data: tournaments, error: tournamentError } = await supabase
    .from('tournaments')
    .select('*')
    .or(`slug.ilike.%${tournamentSlug}%,name.ilike.%${tournamentSlug}%`)

  if (tournamentError || !tournaments || tournaments.length === 0) {
    console.error('❌ Tournoi non trouvé')
    return
  }

  if (tournaments.length > 1) {
    console.log('⚠️ Plusieurs tournois trouvés:')
    tournaments.forEach(t => console.log(`  - ${t.name} (${t.slug})`))
    console.log('Utilisation du premier...')
  }

  const tournament = tournaments[0]

  console.log('\n📊 Tournoi trouvé:')
  console.log(`  - Nom: ${tournament.name}`)
  console.log(`  - early_prediction_bonus: ${tournament.early_prediction_bonus}`)
  console.log(`  - starting_matchday: ${tournament.starting_matchday}`)
  console.log(`  - ending_matchday: ${tournament.ending_matchday}`)

  if (!tournament.early_prediction_bonus) {
    console.log('\n⚠️ La prime d\'avant-match n\'est PAS activée pour ce tournoi')
    return
  }

  // 2. Récupérer les participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, profiles(username)')
    .eq('tournament_id', tournament.id)

  console.log(`\n👥 Participants: ${participants?.length || 0}`)

  // 3. Récupérer les matchs
  const { data: allMatches } = await supabase
    .from('imported_matches')
    .select('id, matchday, utc_date, status, home_score, away_score')
    .eq('competition_id', tournament.competition_id)
    .gte('matchday', tournament.starting_matchday)
    .lte('matchday', tournament.ending_matchday)
    .order('matchday', { ascending: true })
    .order('utc_date', { ascending: true })

  // Grouper par journée
  const matchesByMatchday: Record<number, any[]> = {}
  const firstMatchByMatchday: Record<number, Date> = {}

  for (const match of allMatches || []) {
    const md = match.matchday
    if (!matchesByMatchday[md]) {
      matchesByMatchday[md] = []
    }
    matchesByMatchday[md].push(match)

    const matchDate = new Date(match.utc_date)
    if (!firstMatchByMatchday[md] || matchDate < firstMatchByMatchday[md]) {
      firstMatchByMatchday[md] = matchDate
    }
  }

  console.log('\n📅 Journées:')
  for (const [md, matches] of Object.entries(matchesByMatchday)) {
    const finishedCount = matches.filter(m => m.status === 'FINISHED').length
    console.log(`  J${md}: ${matches.length} matchs (${finishedCount} terminés) - Premier match: ${firstMatchByMatchday[Number(md)].toISOString().substring(0, 16)}`)
  }

  // 4. Pour chaque participant, vérifier les pronostics
  console.log('\n🎯 Vérification des pronostics par joueur:')

  for (const participant of participants || []) {
    const username = (participant.profiles as any)?.username || 'Inconnu'
    console.log(`\n  👤 ${username}:`)

    // Récupérer les pronostics
    const { data: predictions } = await supabase
      .from('predictions')
      .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
      .eq('tournament_id', tournament.id)
      .eq('user_id', participant.user_id)

    // Créer une map des pronostics
    const predictionsByMatch: Record<string, { createdAt: Date, isDefault: boolean }> = {}
    for (const pred of predictions || []) {
      predictionsByMatch[pred.match_id] = {
        createdAt: new Date(pred.created_at),
        isDefault: pred.is_default_prediction || false
      }
    }

    let totalBonus = 0

    for (const [mdStr, matches] of Object.entries(matchesByMatchday)) {
      const md = Number(mdStr)
      const firstMatchTime = firstMatchByMatchday[md]
      const finishedMatches = matches.filter(m => m.status === 'FINISHED')

      if (finishedMatches.length === 0) continue

      let allOnTime = true
      let details: string[] = []

      for (const match of finishedMatches) {
        const pred = predictionsByMatch[match.id]
        if (!pred || pred.isDefault) {
          allOnTime = false
          details.push(`❌ Match ${match.id.substring(0, 8)}: pas de prono`)
        } else if (pred.createdAt >= firstMatchTime) {
          allOnTime = false
          const diff = Math.round((pred.createdAt.getTime() - firstMatchTime.getTime()) / 60000)
          details.push(`❌ Match ${match.id.substring(0, 8)}: prono fait ${diff}min après`)
        } else {
          const diff = Math.round((firstMatchTime.getTime() - pred.createdAt.getTime()) / 60000)
          details.push(`✅ Match ${match.id.substring(0, 8)}: prono fait ${diff}min avant`)
        }
      }

      if (allOnTime) {
        totalBonus += 1
        console.log(`    J${md}: ✅ +1 point (tous les pronos à temps)`)
      } else {
        console.log(`    J${md}: ❌ pas de bonus`)
        for (const d of details.slice(0, 3)) {
          console.log(`      ${d}`)
        }
        if (details.length > 3) {
          console.log(`      ... et ${details.length - 3} autres matchs`)
        }
      }
    }

    console.log(`    📊 Total bonus: +${totalBonus} points`)
  }
}

const slug = process.argv[2] || 'BrazilTest'
checkEarlyBonus(slug)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err)
    process.exit(1)
  })
