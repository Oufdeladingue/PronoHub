/**
 * Transforme un texte en "slug" utilisable dans un nom de fichier :
 * sans accents, minuscules, caractères non alphanumériques → tirets.
 * Ex: "Mission Mundial" → "mission-mundial", "Journée 2" → "journee-2".
 */
export function slugify(input: string | null | undefined, maxLen = 50): string {
  const s = (input || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retirer les accents (marques combinantes après NFD)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // tout le reste → tiret
    .replace(/^-+|-+$/g, '') // trim des tirets
    .slice(0, maxLen)
    .replace(/-+$/g, '')
  return s || 'pronohub'
}

/**
 * Horodatage pour nom de fichier export : "YYYY-MM-DD" (date locale) ou "YYYY-MM-DD-HHhMM"
 * si withTime. Sert à dater un export (snapshot d'un classement/pronos à un instant donné)
 * pour que chaque téléchargement ait un nom unique et contextualisé.
 */
export function fileDateStamp(withTime = false, d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  return withTime ? `${date}-${p(d.getHours())}h${p(d.getMinutes())}` : date
}
