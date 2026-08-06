import { gatePageByCountry } from '@/lib/geo-gate'

/**
 * Gate géo server-side sur le formulaire d'inscription : un visiteur d'un pays
 * non autorisé est redirigé vers /geo-unavailable AVANT le rendu du formulaire,
 * donc il ne peut jamais lancer l'OAuth Google → aucun compte parasite créé.
 */
export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  await gatePageByCountry()
  return children
}
