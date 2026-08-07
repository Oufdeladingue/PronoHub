import { routing, type Locale } from '@/i18n/routing'

/**
 * Normalise une valeur quelconque (ex `profiles.locale`, souvent `string | null`)
 * vers une locale applicative valide. Repli sur la locale par défaut (fr) si
 * inconnue/absente. À utiliser partout où l'on passe une locale de destinataire
 * (emails, push, images OG) pour supporter FR/EN/ES sans ternaires binaires.
 */
export function toAppLocale(value: string | null | undefined): Locale {
  if (value && (routing.locales as readonly string[]).includes(value)) {
    return value as Locale
  }
  return routing.defaultLocale
}
