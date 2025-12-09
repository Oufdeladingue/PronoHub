// Liste des avatars disponibles
export const AVAILABLE_AVATARS = [
  'avatar1',
  'avatar2',
  'avatar3',
  'avatar4',
  'avatar5',
  'avatar6',
  'avatar7',
  'avatar8',
  'avatar9',
  'avatar10',
  'avatar11',
  'avatar12',
] as const

export type AvatarId = typeof AVAILABLE_AVATARS[number]

// Mapping des trophées vers leurs images
export const TROPHY_AVATAR_MAP: Record<string, string> = {
  'king_of_day': '/trophy/king-of-day.png',
  'correct_result': '/trophy/bon-resultat.png',
  'exact_score': '/trophy/score-exact.png',
  'tournament_winner': '/trophy/tournoi.png',
  'double_king': '/trophy/double.png',
  'opportunist': '/trophy/opportuniste.png',
  'nostradamus': '/trophy/nostra.png',
  'bonus_profiteer': '/trophy/profiteur.png',
  'bonus_optimizer': '/trophy/optimisateur.png',
  'ultra_dominator': '/trophy/dominateur.png',
  'lantern': '/trophy/lanterne.png',
  'downward_spiral': '/trophy/spirale.png',
  'abyssal': '/trophy/abyssal.png',
  'poulidor': '/trophy/poulidor.png',
  'cursed': '/trophy/maudit.png',
  'legend': '/trophy/LEGENDE.png',
}

// Vérifier si un avatarId est un trophée
export function isTrophyAvatar(avatarId: string): boolean {
  return avatarId.startsWith('trophy_')
}

// Extraire le type de trophée depuis l'avatarId
export function getTrophyTypeFromAvatar(avatarId: string): string | null {
  if (!isTrophyAvatar(avatarId)) return null
  return avatarId.replace('trophy_', '')
}

// Fonction pour obtenir l'URL d'un avatar (supporte les avatars classiques et les trophées)
export function getAvatarUrl(avatarId: string): string {
  // Si c'est un avatar trophée (format: trophy_king_of_day)
  if (isTrophyAvatar(avatarId)) {
    const trophyType = getTrophyTypeFromAvatar(avatarId)
    if (trophyType && TROPHY_AVATAR_MAP[trophyType]) {
      return TROPHY_AVATAR_MAP[trophyType]
    }
  }
  // Sinon c'est un avatar classique
  return `/avatars/${avatarId}.png`
}

// Fonction pour obtenir un avatar par défaut basé sur l'initiale
export function getDefaultAvatar(username: string): AvatarId {
  if (!username) return 'avatar1'
  const index = username.charCodeAt(0) % AVAILABLE_AVATARS.length
  return AVAILABLE_AVATARS[index]
}
