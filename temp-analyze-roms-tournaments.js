const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://txpmihreaxmtsxlgmdko.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4cG1paHJlYXhtdHN4bGdtZGtvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTU5MDIyNiwiZXhwIjoyMDc3MTY2MjI2fQ.so6lF4GH-DGbSr3EYmzxS24kRxTgzF7-aT3OV1o5QJQ'

const supabase = createClient(supabaseUrl, supabaseKey)

async function analyzeRomsTournaments() {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', "Rom's")
      .single()

    console.log('User ID:', profile.id)
    console.log('')

    // Récupérer TOUTES les participations avec détails complets
    const { data: participations } = await supabase
      .from('tournament_participants')
      .select(`
        tournament_id,
        invite_type,
        participant_role,
        created_at as joined_at,
        tournaments (
          id,
          name,
          slug,
          tournament_type,
          status,
          created_by,
          created_at,
          is_legacy
        )
      `)
      .eq('user_id', profile.id)

    // Filtrer les tournois actifs (status != completed)
    const activeTournaments = participations?.filter(p =>
      p.tournaments && p.tournaments.status !== 'completed'
    ) || []

    console.log('========================================')
    console.log(`TOTAL TOURNOIS ACTIFS: ${activeTournaments.length}`)
    console.log('========================================')
    console.log('')

    // Grouper par type de tournoi
    const byType = {}
    activeTournaments.forEach(p => {
      const type = p.tournaments?.tournament_type || 'free'
      if (!byType[type]) byType[type] = []
      byType[type].push(p)
    })

    console.log('RÉPARTITION PAR TYPE:')
    Object.entries(byType).forEach(([type, tournaments]) => {
      console.log(`  ${type.toUpperCase()}: ${tournaments.length}`)
    })
    console.log('')

    // Analyser chaque tournoi en détail
    activeTournaments.forEach((p, index) => {
      const t = p.tournaments
      const isCaptain = t.created_by === profile.id
      const role = isCaptain ? '⭐ CAPITAINE' : '👤 MEMBRE'

      console.log(`────────────────────────────────────────`)
      console.log(`${index + 1}. ${t.name}`)
      console.log(`────────────────────────────────────────`)
      console.log(`   Formule: ${t.tournament_type?.toUpperCase() || 'FREE-KICK'}`)
      console.log(`   Status: ${t.status}`)
      console.log(`   Rôle: ${role}`)
      console.log(`   Invite type: ${p.invite_type}`)
      console.log(`   Créé le: ${new Date(t.created_at).toLocaleDateString('fr-FR')}`)
      console.log(`   Rejoint le: ${new Date(p.joined_at).toLocaleDateString('fr-FR')}`)
      console.log(`   Legacy: ${t.is_legacy ? 'Oui' : 'Non'}`)

      // Déterminer comment il a rejoint/créé
      if (isCaptain) {
        console.log(`   → Créé par Rom's (ne consomme pas de slot pour rejoindre)`)
      } else {
        if (p.invite_type === 'free') {
          if (t.tournament_type === 'free') {
            console.log(`   → Rejoint avec un SLOT GRATUIT (2 max pour Free-Kick)`)
          } else {
            console.log(`   → Rejoint avec INVITATION GRATUITE (1 max pour One-Shot/Elite)`)
          }
        } else if (p.invite_type === 'paid_slot') {
          console.log(`   → Rejoint avec un SLOT ACHETÉ (0.99€)`)
        } else if (p.invite_type === 'prepaid_slot') {
          console.log(`   → Rejoint avec un SLOT PRÉPAYÉ (Platinium group)`)
        } else {
          console.log(`   → Type d'invitation: ${p.invite_type}`)
        }
      }
      console.log('')
    })

    // Compter les utilisations
    console.log('========================================')
    console.log('ANALYSE DES SLOTS CONSOMMÉS')
    console.log('========================================')

    const freeKickMembers = activeTournaments.filter(p =>
      (p.tournaments?.tournament_type === 'free' || !p.tournaments?.tournament_type) &&
      p.tournaments?.created_by !== profile.id &&
      !p.tournaments?.is_legacy
    )

    const premiumInvites = activeTournaments.filter(p =>
      ['oneshot', 'elite'].includes(p.tournaments?.tournament_type) &&
      p.tournaments?.created_by !== profile.id &&
      !p.tournaments?.is_legacy &&
      p.invite_type === 'free'
    )

    const paidSlots = activeTournaments.filter(p =>
      p.tournaments?.created_by !== profile.id &&
      ['paid_slot', 'prepaid_slot'].includes(p.invite_type)
    )

    const captains = activeTournaments.filter(p =>
      p.tournaments?.created_by === profile.id
    )

    console.log(``)
    console.log(`Participations Free-Kick (membre): ${freeKickMembers.length}/2 slots gratuits`)
    freeKickMembers.forEach(p => {
      console.log(`  - ${p.tournaments.name} (${p.invite_type})`)
    })

    console.log(``)
    console.log(`Invitations One-Shot/Elite (membre): ${premiumInvites.length}/1 invitation gratuite`)
    premiumInvites.forEach(p => {
      console.log(`  - ${p.tournaments.name} (${p.tournaments.tournament_type})`)
    })

    console.log(``)
    console.log(`Slots payants utilisés: ${paidSlots.length}`)
    paidSlots.forEach(p => {
      console.log(`  - ${p.tournaments.name} (${p.invite_type})`)
    })

    console.log(``)
    console.log(`Tournois créés (capitaine): ${captains.length}`)
    captains.forEach(p => {
      console.log(`  - ${p.tournaments.name} (${p.tournaments.tournament_type || 'free'})`)
    })

  } catch (error) {
    console.error('Erreur:', error)
  }
}

analyzeRomsTournaments()
