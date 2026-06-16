/**
 * Cache mémoire (durée de vie du process) des polices Inter utilisées par les images OG.
 *
 * Avant : chaque génération d'image (déclenchée en rafale par les crons de notification)
 * re-téléchargeait les 3 graisses depuis fonts.gstatic.com → +200-800 ms et point de
 * défaillance externe. Ici on met en cache la Promise par graisse : un seul téléchargement
 * par graisse et par process, partagé entre tous les appels.
 */
const FONT_URLS: Record<number, string> = {
  400: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff',
  700: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff',
  900: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuBWYAZ9hjp-Ek-_EeA.woff',
}

const cache = new Map<number, Promise<ArrayBuffer>>()

async function fetchFont(weight: number): Promise<ArrayBuffer> {
  const res = await fetch(FONT_URLS[weight])
  if (!res.ok) throw new Error(`font load failed (${weight}): ${res.status}`)
  return res.arrayBuffer()
}

/** Charge une graisse de police Inter (400/700/900), mise en cache pour le process. */
export function loadOgFont(weight: number = 400): Promise<ArrayBuffer> {
  const w = FONT_URLS[weight] ? weight : 400
  let p = cache.get(w)
  if (!p) {
    // En cas d'échec, on retire l'entrée pour permettre une nouvelle tentative au prochain appel
    p = fetchFont(w).catch((e) => { cache.delete(w); throw e })
    cache.set(w, p)
  }
  return p
}
