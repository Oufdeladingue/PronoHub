/**
 * Informations partagées sur les trophées (client + serveur)
 * Extraites depuis hooks/useTrophyNotifications.ts pour usage côté cron
 */

export interface TrophyInfo {
  name: string
  description: string
  imagePath: string
}

export function getTrophyInfo(trophyType: string): TrophyInfo {
  const trophyMap: Record<string, TrophyInfo> = {
    correct_result: {
      name: 'Le Veinard',
      description: 'Pronostiquer au moins 1 bon résultat',
      imagePath: '/trophy/bon-resultat.png'
    },
    exact_score: {
      name: 'L\'Analyste',
      description: 'Pronostiquer au moins 1 score exact',
      imagePath: '/trophy/score-exact.png'
    },
    king_of_day: {
      name: 'The King of Day',
      description: 'Être premier au classement d\'une journée (sans égalité)',
      imagePath: '/trophy/king-of-day.png'
    },
    double_king: {
      name: 'Le Roi du Doublé',
      description: 'Être premier à deux journées consécutives',
      imagePath: '/trophy/double.png'
    },
    opportunist: {
      name: 'L\'Opportuniste',
      description: '2 bons résultats sur la même journée',
      imagePath: '/trophy/opportuniste.png'
    },
    nostradamus: {
      name: 'Le Nostradamus',
      description: '2 scores exacts sur la même journée',
      imagePath: '/trophy/nostra.png'
    },
    lantern: {
      name: 'La Lanterne-rouge',
      description: 'Être dernier au classement d\'une journée (sans égalité)',
      imagePath: '/trophy/lanterne.png'
    },
    downward_spiral: {
      name: 'La Spirale infernale',
      description: 'Être dernier deux journées de suite',
      imagePath: '/trophy/spirale.png'
    },
    bonus_profiteer: {
      name: 'Le Profiteur',
      description: '1 bon résultat sur un match Bonus',
      imagePath: '/trophy/profiteur.png'
    },
    bonus_optimizer: {
      name: 'L\'Optimisateur',
      description: '1 score exact sur un match Bonus',
      imagePath: '/trophy/optimisateur.png'
    },
    ultra_dominator: {
      name: 'L\'Ultra-dominateur',
      description: 'Être premier à CHAQUE journée du tournoi',
      imagePath: '/trophy/dominateur.png'
    },
    poulidor: {
      name: 'Le Poulidor',
      description: 'Aucune première place sur toutes les journées d\'un tournoi terminé',
      imagePath: '/trophy/poulidor.png'
    },
    cursed: {
      name: 'Le Maudit',
      description: 'Aucun bon résultat sur une journée de tournoi',
      imagePath: '/trophy/maudit.png'
    },
    tournament_winner: {
      name: 'Le Ballon d\'or',
      description: '1er au classement final d\'un tournoi (sans égalité)',
      imagePath: '/trophy/tournoi.png'
    },
    legend: {
      name: 'La Légende',
      description: 'Vainqueur d\'un tournoi avec plus de 10 participants',
      imagePath: '/trophy/LEGENDE.png'
    },
    abyssal: {
      name: 'L\'Abyssal',
      description: 'Dernier au classement final d\'un tournoi (sans égalité)',
      imagePath: '/trophy/abyssal.png'
    }
  }

  return trophyMap[trophyType] || {
    name: 'Trophée Inconnu',
    description: 'Description non disponible',
    imagePath: '/trophy/default.png'
  }
}

export const ALL_TROPHY_TYPES = [
  'correct_result', 'exact_score', 'king_of_day', 'double_king',
  'opportunist', 'nostradamus', 'lantern', 'downward_spiral',
  'bonus_profiteer', 'bonus_optimizer', 'ultra_dominator',
  'poulidor', 'cursed', 'tournament_winner', 'legend', 'abyssal'
] as const

export type TrophyType = typeof ALL_TROPHY_TYPES[number]

/**
 * UUIDs hardcodés pour chaque type de trophée
 * Utilisés comme match_id dans notification_logs pour la déduplication
 */
export const TROPHY_TYPE_UUIDS: Record<string, string> = {
  correct_result:   '10000000-0000-0000-0000-000000000001',
  exact_score:      '10000000-0000-0000-0000-000000000002',
  king_of_day:      '10000000-0000-0000-0000-000000000003',
  double_king:      '10000000-0000-0000-0000-000000000004',
  opportunist:      '10000000-0000-0000-0000-000000000005',
  nostradamus:      '10000000-0000-0000-0000-000000000006',
  lantern:          '10000000-0000-0000-0000-000000000007',
  downward_spiral:  '10000000-0000-0000-0000-000000000008',
  bonus_profiteer:  '10000000-0000-0000-0000-000000000009',
  bonus_optimizer:  '10000000-0000-0000-0000-000000000010',
  ultra_dominator:  '10000000-0000-0000-0000-000000000011',
  poulidor:         '10000000-0000-0000-0000-000000000012',
  cursed:           '10000000-0000-0000-0000-000000000013',
  tournament_winner:'10000000-0000-0000-0000-000000000014',
  legend:           '10000000-0000-0000-0000-000000000015',
  abyssal:          '10000000-0000-0000-0000-000000000016',
}
