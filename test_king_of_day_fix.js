require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testKingOfDayFix() {
  try {
    console.log('=== TEST DE LA NOUVELLE LOGIQUE "KING OF DAY" ===\n')

    // Cas de test : Journée 32 du BrazilTest
    // Tous les utilisateurs ont 0 points, donc personne ne devrait avoir le trophée

    const { data: user } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', 'joueur1')
      .single()

    console.log('Utilisateur testé:', user.username, '\n')

    const { data: tournament } = await supabase
      .from('tournaments')
      .select('id, name, starting_matchday, ending_matchday, competition_id')
      .ilike('name', '%BrazilTest%')
      .single()

    const matchday = 32

    console.log('Scénario: Journée', matchday, 'du tournoi', tournament.name)

    // Récupérer les matchs
    const { data: journeyMatches } = await supabase
      .from('imported_matches')
      .select('id, status, finished, home_score, away_score, utc_date')
      .eq('competition_id', tournament.competition_id)
      .eq('matchday', matchday)

    const allMatchesFinished = journeyMatches?.every(m =>
      (m.status === 'FINISHED' || m.finished === true) &&
      m.home_score !== null &&
      m.away_score !== null
    )

    console.log('Tous les matchs terminés?', allMatchesFinished ? 'OUI' : 'NON')

    if (!allMatchesFinished) {
      console.log('✗ Pré-requis non rempli\n')
      return
    }

    // Récupérer les participants
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournament.id)

    const userIds = participants.map(p => p.user_id)
    const matchIds = journeyMatches.map(m => m.id)

    // Récupérer les pronostics
    const { data: journeyPredictions } = await supabase
      .from('predictions')
      .select('user_id, points_earned, profiles(username)')
      .eq('tournament_id', tournament.id)
      .in('user_id', userIds)
      .in('match_id', matchIds)

    // Calculer les points
    const userPoints = {}
    journeyPredictions.forEach(pred => {
      if (!userPoints[pred.user_id]) {
        userPoints[pred.user_id] = {
          username: pred.profiles.username,
          points: 0
        }
      }
      userPoints[pred.user_id].points += pred.points_earned || 0
    })

    const maxPoints = Math.max(...Object.values(userPoints).map(u => u.points))
    const usersWithMaxPoints = Object.values(userPoints).filter(u => u.points === maxPoints).length

    console.log('\nClassement:')
    Object.entries(userPoints)
      .sort((a, b) => b[1].points - a[1].points)
      .forEach(([uid, data], idx) => {
        const isTarget = uid === user.id
        console.log(`  ${idx + 1}. ${data.username}: ${data.points} pts${isTarget ? ' ← TESTÉ' : ''}`)
      })

    console.log('\nAnalyse:')
    console.log(`  Points maximum: ${maxPoints}`)
    console.log(`  Utilisateurs avec max points: ${usersWithMaxPoints}`)
    console.log(`  L'utilisateur testé a le max? ${userPoints[user.id]?.points === maxPoints ? 'OUI' : 'NON'}`)

    console.log('\nLogique de décision:')
    if (userPoints[user.id]?.points === maxPoints) {
      console.log('  ✓ L\'utilisateur a le maximum de points')

      if (maxPoints > 0) {
        console.log('  ✓ maxPoints > 0')
        console.log('  → TROPHÉE DÉBLOQUÉ')
      } else if (usersWithMaxPoints === 1) {
        console.log('  ⚠️ maxPoints === 0')
        console.log('  ✓ L\'utilisateur est SEUL avec 0 points')
        console.log('  → TROPHÉE DÉBLOQUÉ')
      } else {
        console.log('  ⚠️ maxPoints === 0')
        console.log(`  ✗ ${usersWithMaxPoints} utilisateurs à égalité avec 0 points`)
        console.log('  → TROPHÉE NON DÉBLOQUÉ (égalité)')
      }
    } else {
      console.log('  ✗ L\'utilisateur n\'a PAS le maximum de points')
      console.log('  → TROPHÉE NON DÉBLOQUÉ')
    }

  } catch (error) {
    console.error('Erreur:', error)
  }
}

testKingOfDayFix()
