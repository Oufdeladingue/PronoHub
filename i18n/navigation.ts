import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Wrappers de navigation conscients de la locale.
 * À utiliser À LA PLACE de `next/link` et `next/navigation` dans les
 * composants traduits : ils ajoutent/retirent automatiquement le préfixe
 * de langue selon la locale active.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
