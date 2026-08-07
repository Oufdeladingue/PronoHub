import { emailMessages } from './messages'

export type EmailLocale = 'fr' | 'en'

// Traducteur synchrone : lookup par chemin pointé + interpolation {param}.
// Fallback : si la clé manque en EN, retombe sur FR ; si absente partout, renvoie la clé.
export function emailT(locale?: EmailLocale) {
  const loc: EmailLocale = locale === 'en' ? 'en' : 'fr'
  return function t(key: string, params?: Record<string, string | number>): string {
    const lookup = (cat: any) => key.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), cat)
    let raw = lookup(emailMessages[loc])
    if (raw == null) raw = lookup(emailMessages.fr) // fallback FR
    let str = typeof raw === 'string' ? raw : key
    if (params) for (const [k, v] of Object.entries(params)) str = str.split(`{${k}}`).join(String(v))
    return str
  }
}

// Pluriel simple (les emails n'ont pas besoin d'ICU complet)
export function emailPlural(n: number, one: string, other: string): string {
  return n === 1 ? one : other
}
