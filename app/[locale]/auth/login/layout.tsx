import { gatePageByCountry } from '@/lib/geo-gate'

/**
 * Gate géo server-side sur la page de connexion : la connexion Google crée aussi
 * un compte pour un nouveau visiteur. On bloque donc les pays non autorisés AVANT
 * le rendu, comme sur /auth/signup.
 */
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  await gatePageByCountry()
  return children
}
