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

// Fonction pour obtenir l'URL d'un avatar
export function getAvatarUrl(avatarId: string): string {
  return `/avatars/${avatarId}.png`
}

// Fonction pour obtenir un avatar par défaut basé sur l'initiale
export function getDefaultAvatar(username: string): AvatarId {
  if (!username) return 'avatar1'
  const index = username.charCodeAt(0) % AVAILABLE_AVATARS.length
  return AVAILABLE_AVATARS[index]
}
