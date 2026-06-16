/**
 * Allowlist anti-SSRF pour les images récupérées par les routes OG.
 *
 * Les routes /api/og/* sont publiques et fetchent des URLs d'images fournies en query-param
 * (logos d'équipe, emblèmes, avatars). Sans contrôle, un attaquant peut viser des cibles
 * internes (169.254.169.254, services Docker, localhost…). On n'autorise que :
 *  - https uniquement
 *  - les hôtes d'images connus (football-data, api-sports)
 *  - l'hôte du projet Supabase (logos custom stockés dans le bucket public)
 *  - l'hôte de l'app (avatars/images servis depuis /avatars, /images, /trophy)
 */
const STATIC_ALLOWED_HOSTS = new Set<string>([
  'crests.football-data.org',
  'media.api-sports.io',
  'www.pronohub.club',
  'pronohub.club',
])

function hostOf(envUrl: string | undefined): string | null {
  try {
    return envUrl ? new URL(envUrl).hostname : null
  } catch {
    return null
  }
}

// Hôtes dérivés de l'environnement (Supabase + URL publique de l'app)
const DYNAMIC_ALLOWED_HOSTS = [
  hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
  hostOf(process.env.NEXT_PUBLIC_APP_URL),
  hostOf(process.env.NEXT_PUBLIC_BASE_URL),
].filter((h): h is string => !!h)

export function isAllowedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  if (STATIC_ALLOWED_HOSTS.has(u.hostname)) return true
  if (DYNAMIC_ALLOWED_HOSTS.includes(u.hostname)) return true
  return false
}
