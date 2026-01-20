/**
 * Récupère le chemin sécurisé du panel admin
 * Défini dans la variable d'environnement NEXT_PUBLIC_ADMIN_PANEL_PATH
 */
export function getAdminPath(): string {
  return process.env.NEXT_PUBLIC_ADMIN_PANEL_PATH || 'sys-panel-svspgrn1kzw8'
}

/**
 * Génère une URL complète vers le panel admin
 */
export function getAdminUrl(subPath: string = ''): string {
  const adminPath = getAdminPath()
  const cleanSubPath = subPath.startsWith('/') ? subPath.slice(1) : subPath
  return cleanSubPath ? `/${adminPath}/${cleanSubPath}` : `/${adminPath}`
}
