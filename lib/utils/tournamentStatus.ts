export type TournamentStatusType = 
  | 'warmup'           // À l'échauffement
  | 'ready'            // Prêt à rentrer
  | 'missing_pronos'   // Pronos manquant (côté user)
  | 'playing'          // Ça joue
  | 'injury_time'      // Temps additionnel
  | 'awards'           // Remise des trophées

export interface TournamentStatusInfo {
  type: TournamentStatusType
  label: string
  bgColor: string
  textColor: string
}

export function getTournamentStatus(
  tournament: {
    status: string
    current_participants: number
    max_players: number
    current_matchday?: number
    num_matchdays: number
  },
  userHasMissingPronos?: boolean
): TournamentStatusInfo {
  const { status, current_participants, max_players, current_matchday = 0, num_matchdays } = tournament

  // Remise des trophées (tournoi terminé)
  if (status === 'finished' || status === 'completed') {
    return {
      type: 'awards',
      label: 'Remise des trophées',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700'
    }
  }

  // À l'échauffement (en attente de participants)
  if (status === 'pending' || status === 'warmup') {
    // Si le tournoi est complet, prêt à rentrer
    if (current_participants >= max_players) {
      return {
        type: 'ready',
        label: 'Prêt à rentrer',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-700'
      }
    }
    // Sinon, à l'échauffement
    return {
      type: 'warmup',
      label: "À l'échauffement",
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-700'
    }
  }

  // Tournoi actif
  if (status === 'active') {
    // Temps additionnel (dernière journée)
    if (current_matchday === num_matchdays) {
      return {
        type: 'injury_time',
        label: 'Temps additionnel',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700'
      }
    }

    // Pronos manquant (côté user)
    if (userHasMissingPronos) {
      return {
        type: 'missing_pronos',
        label: 'Pronos manquant',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700'
      }
    }

    // Ça joue (par défaut)
    return {
      type: 'playing',
      label: 'Ça joue',
      bgColor: 'bg-green-100',
      textColor: 'text-green-700'
    }
  }

  // Fallback
  return {
    type: 'warmup',
    label: "À l'échauffement",
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700'
  }
}
