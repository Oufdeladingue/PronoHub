import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

/**
 * Charge les messages de la locale courante pour chaque requête (Server Components).
 * La locale est déterminée par le middleware next-intl (préfixe URL > cookie >
 * Accept-Language > défaut). Repli sur `defaultLocale` si invalide.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
