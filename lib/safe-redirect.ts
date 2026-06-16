/**
 * Validation des chemins de redirection (anti open-redirect).
 *
 * Un `redirectTo` fourni par l'utilisateur ne doit JAMAIS pouvoir pointer vers un domaine
 * externe. Concaténé naïvement (`${origin}${redirectTo}`), une valeur comme `@evil.com` ou
 * `.evil.com` détourne l'URL finale vers un site pirate (phishing).
 *
 * On n'accepte qu'un chemin local : commençant par un seul "/" (pas "//" ni "/\"),
 * sans caractère de contrôle. Sinon on retombe sur le fallback.
 */
export function safePath(input: string | null | undefined, fallback = '/dashboard'): string {
  if (!input) return fallback
  let p = input
  // Les params OAuth sont parfois doublement encodés → on décode une fois prudemment.
  try {
    p = decodeURIComponent(input)
  } catch {
    return fallback
  }
  if (!p.startsWith('/')) return fallback
  // "//evil.com" ou "/\evil.com" → URL protocol-relative / contournement
  if (p.startsWith('//') || p.startsWith('/\\')) return fallback
  // Pas de saut de ligne / caractères de contrôle (CRLF injection, etc.)
  if (/[\x00-\x1f]/.test(p)) return fallback
  return p
}
