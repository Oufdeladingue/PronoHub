/**
 * Échappement HTML pour toute valeur contrôlée par l'utilisateur (username, message de chat…)
 * injectée dans le HTML d'un email. Défense en profondeur : même si la contrainte DB
 * `username_len_safe` bloque déjà `< > "`, on neutralise ici toute chaîne dynamique côté rendu.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Neutralise l'injection de formule dans une cellule CSV (Excel/Sheets exécutent
 * les valeurs commençant par = + - @ TAB CR). Quote aussi si nécessaire.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // préfixe apostrophe = neutralise la formule
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"'
  return s
}
