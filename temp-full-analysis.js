const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txpmihreaxmtsxlgmdko.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function fullAnalysis() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', "Rom's")
    .single()

  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('user_id', profile.id)

  const tournamentIds = participations.map(p => p.tournament_id)

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .in('id', tournamentIds)

  // Enrichir avec les participations
  const enriched = tournaments.map(t => ({
    ...t,
    ...participations.find(p => p.tournament_id === t.id)
  }))

  // Filtrer actifs (tous sauf completed)
  const active = enriched.filter(t => t.status !== 'completed')

  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              ANALYSE COMPLÈTE DES TOURNOIS DE ROM\'S            ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Total tournois: ${enriched.length}`)
  console.log(`Tournois actifs (≠ completed): ${active.length}`)
  console.log('')

  // Grouper par status
  const byStatus = {}
  active.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
  })

  console.log('RÉPARTITION PAR STATUS:')
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })
  console.log('')

  // Détail de chaque tournoi actif
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                    DÉTAIL DES 10 TOURNOIS ACTIFS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  active.forEach((t, i) => {
    const isCaptain = t.created_by === profile.id
    const role = isCaptain ? '⭐ CAPITAINE' : '👤 MEMBRE'
    const type = t.tournament_type || 'free'

    console.log(`${i + 1}. ${t.name}`)
    console.log(`   ${'─'.repeat(60)}`)
    console.log(`   Formule:      ${type.toUpperCase()}`)
    console.log(`   Status:       ${t.status.toUpperCase()}`)
    console.log(`   Rôle:         ${role}`)
    console.log(`   Invite type:  ${t.invite_type}`)
    console.log(`   Legacy:       ${t.is_legacy ? 'Oui' : 'Non'}`)

    // Explication
    if (isCaptain) {
      console.log(`   📝 Créé par Rom's → NE CONSOMME PAS DE SLOT`)
    } else {
      if (t.invite_type === 'free') {
        if (type === 'free') {
          console.log(`   🎫 Rejoint avec SLOT GRATUIT Free-Kick (2 max)`)
        } else if (['oneshot', 'elite'].includes(type)) {
          console.log(`   🎫 Rejoint avec INVITATION GRATUITE One-Shot/Elite (1 max)`)
        }
      } else if (t.invite_type === 'paid_slot') {
        console.log(`   💳 Rejoint avec SLOT ACHETÉ (0.99€)`)
      } else if (t.invite_type === 'prepaid_slot') {
        console.log(`   💎 Rejoint avec SLOT PRÉPAYÉ Platinium`)
      }
    }
    console.log('')
  })

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                 COMPTAGE DES SLOTS CONSOMMÉS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // Free-Kick en tant que membre
  const freeKickMembers = active.filter(t =>
    (t.tournament_type === 'free' || !t.tournament_type) &&
    t.created_by !== profile.id &&
    !t.is_legacy
  )

  console.log(`🎮 SLOTS GRATUITS FREE-KICK (membre): ${freeKickMembers.length}/2`)
  freeKickMembers.forEach(t => {
    console.log(`   ✓ ${t.name} (status: ${t.status})`)
  })
  console.log('')

  // One-Shot/Elite en tant que membre avec invitation gratuite
  const premiumInvites = active.filter(t =>
    ['oneshot', 'elite'].includes(t.tournament_type) &&
    t.created_by !== profile.id &&
    !t.is_legacy &&
    t.invite_type === 'free'
  )

  console.log(`🎁 INVITATION GRATUITE ONE-SHOT/ELITE (membre): ${premiumInvites.length}/1`)
  premiumInvites.forEach(t => {
    console.log(`   ✓ ${t.name} (${t.tournament_type}, status: ${t.status})`)
  })
  console.log('')

  // Slots payants
  const paidSlots = active.filter(t =>
    t.created_by !== profile.id &&
    ['paid_slot', 'prepaid_slot'].includes(t.invite_type)
  )

  console.log(`💳 SLOTS PAYANTS UTILISÉS: ${paidSlots.length}`)
  paidSlots.forEach(t => {
    console.log(`   ✓ ${t.name} (${t.invite_type}, status: ${t.status})`)
  })
  console.log('')

  // Tournois créés
  const created = active.filter(t => t.created_by === profile.id)

  console.log(`⭐ TOURNOIS CRÉÉS (capitaine): ${created.length}`)
  const byTypeCreated = {}
  created.forEach(t => {
    const type = t.tournament_type || 'free'
    byTypeCreated[type] = (byTypeCreated[type] || 0) + 1
    console.log(`   ✓ ${t.name} (${type}, status: ${t.status})`)
  })
  console.log('')
  console.log('   Répartition:')
  Object.entries(byTypeCreated).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count}`)
  })
  console.log('')

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                        RÉSUMÉ FINAL')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log(`✅ Slots Free-Kick gratuits consommés: ${freeKickMembers.length}/2`)
  console.log(`✅ Invitation One-Shot/Elite gratuite: ${premiumInvites.length}/1`)
  console.log(`✅ Slots payants utilisés: ${paidSlots.length}`)
  console.log(`✅ Tournois créés: ${created.length}`)
  console.log('')
  console.log(`📊 Total tournois actifs: ${active.length}`)
  console.log(`   - Free-Kick: ${active.filter(t => !t.tournament_type || t.tournament_type === 'free').length}`)
  console.log(`   - One-Shot: ${active.filter(t => t.tournament_type === 'oneshot').length}`)
  console.log(`   - Elite: ${active.filter(t => t.tournament_type === 'elite').length}`)
  console.log(`   - Platinium: ${active.filter(t => t.tournament_type === 'platinium').length}`)
  console.log('')

  // Analyse du problème
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('                    ⚠️  ANALYSE DU PROBLÈME')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('PROBLÈME DÉTECTÉ:')
  console.log(`Rom's a ${freeKickMembers.length} participations Free-Kick comme membre`)
  console.log(`Limite autorisée: 2 slots gratuits`)
  console.log('')
  if (freeKickMembers.length <= 2) {
    console.log('✅ Rom\'s est dans les limites normales')
  } else {
    console.log(`❌ Rom's dépasse de ${freeKickMembers.length - 2} la limite !`)
    console.log('   Il devrait avoir utilisé des slots payants pour ces tournois')
  }
  console.log('')
  console.log('TOUS LES TOURNOIS FREE-KICK SONT MARQUÉS invite_type="free"')
  console.log('Cela suggère qu\'il les a créés AVANT le système de limite,')
  console.log('ou qu\'il y a un bug dans la vérification à la création.')
}

fullAnalysis()
