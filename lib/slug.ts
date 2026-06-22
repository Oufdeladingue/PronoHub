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
