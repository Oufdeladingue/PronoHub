import { defineRouting } from 'next-intl/routing'

/**
 * Configuration i18n centrale (next-intl).
 *
 * - `defaultLocale: 'fr'` + `localePrefix: 'as-needed'` :
 *   le FR (langue par défaut) GARDE ses URLs actuelles (`/dashboard`, pas `/fr/dashboard`)
 *   → zéro perte SEO, zéro lien cassé, zéro souci Capacitor.
 *   Seules les autres langues prennent un préfixe (`/en/dashboard`).
 *
 * - `localeCookie` : mémorise le choix explicite du joueur (cookie NEXT_LOCALE),
 *   pour une langue instantanée avant même le chargement de la session.
 *
 * Ajouter une langue = ajouter son code ici + le fichier messages/<code>.json.
 */
export const routing = defineRouting({
  locales: ['fr', 'en', 'es', 'de', 'it'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed',
  localeCookie: {
    name: 'NEXT_LOCALE',
    maxAge: 60 * 60 * 24 * 365, // 1 an
  },
})

export type Locale = (typeof routing.locales)[number]
