import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { detectCountry, getAllowedCountries } from '@/lib/geo'

/**
 * Gate server-side : bloque l'accès à une page pour les pays NON autorisés,
 * AVANT tout rendu — donc AVANT que le visiteur puisse lancer un OAuth Google
 * qui créerait un compte "fantôme" (le compte Supabase est créé à l'échange
 * OAuth, bien avant que le callback ne bloque le pays).
 *
 * Fail-OPEN si le pays est indétectable (cf-ipcountry absent / IP locale) :
 * on ne bloque JAMAIS un visiteur sur un réseau atypique. Le callback OAuth
 * fait le même fail-open, donc ces visiteurs ne deviennent pas des fantômes.
 * Fail-CLOSED uniquement sur un pays CONNU et non autorisé (= signature exacte
 * des inscriptions parasites géo-bloquées).
 */
export async function gatePageByCountry(): Promise<void> {
  const h = await headers()
  const req = new Request('https://www.pronohub.club', {
    headers: new Headers(Object.fromEntries(h.entries())),
  })

  const country = detectCountry(req)
  if (!country) return // indétectable → laisser passer (fail-open)

  const allowed = await getAllowedCountries()
  if (!allowed.includes(country)) {
    redirect(`/geo-unavailable?c=${country}`)
  }
}
