/**
 * Détection des navigateurs INTÉGRÉS (in-app / webview) — Instagram, Facebook, TikTok, etc.
 *
 * POURQUOI : le Google OAuth web se casse quasi systématiquement dans ces webviews (Google
 * bloque `disallowed_useragent` et/ou le round-trip PKCE perd son cookie entre le webview et
 * la Custom Tab). Diagnostic prod : provider Google = 15% de complétion vs email = 66% ; ~85%
 * des inscrits Google ne reviennent jamais dans l'app. On détecte ces contextes pour proposer
 * un chemin qui marche (navigateur système / inscription email) au lieu de perdre l'utilisateur.
 *
 * Détection par user-agent (best-effort, volontairement large). Ne bloque JAMAIS : sert
 * uniquement à AFFICHER une aide et à ré-ordonner les options. Aucune fonctionnalité retirée.
 */

export interface InAppBrowserInfo {
  isInApp: boolean
  app: string | null   // nom lisible de l'app hôte, si identifiée
  isIOS: boolean
  isAndroid: boolean
}

// Signatures d'apps connues (UA). L'ordre importe peu ; on renvoie la 1re qui matche.
const KNOWN: Array<{ re: RegExp; name: string }> = [
  { re: /Instagram/i, name: 'Instagram' },
  { re: /FBAN|FBAV|FB_IAB|FBIOS|FBDV|\bFB\b/i, name: 'Facebook' },
  { re: /Messenger|MessengerForiOS/i, name: 'Messenger' },
  { re: /TikTok|musical_ly|BytedanceWebview|trill_/i, name: 'TikTok' },
  { re: /Snapchat/i, name: 'Snapchat' },
  { re: /Twitter|\bX11.*Mobile\b/i, name: 'X (Twitter)' },
  { re: /LinkedInApp/i, name: 'LinkedIn' },
  { re: /Pinterest/i, name: 'Pinterest' },
  { re: /WhatsApp/i, name: 'WhatsApp' },
  { re: /\bLine\//i, name: 'Line' },
  { re: /GSA\//i, name: 'Google App' },       // app Google (recherche) — webview aussi problématique
  { re: /musical_ly|Kwai/i, name: 'Kwai' },
]

/**
 * Analyse un user-agent. Renvoie {isInApp, app, isIOS, isAndroid}.
 * `ua` optionnel (défaut: navigator.userAgent côté client). Sûr côté serveur (renvoie isInApp=false si pas d'UA).
 */
export function detectInAppBrowser(ua?: string): InAppBrowserInfo {
  const s = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const isIOS = /iPhone|iPad|iPod/i.test(s)
  const isAndroid = /Android/i.test(s)

  if (!s) return { isInApp: false, app: null, isIOS, isAndroid }

  // 1) Apps hôtes connues
  for (const k of KNOWN) {
    if (k.re.test(s)) return { isInApp: true, app: k.name, isIOS, isAndroid }
  }

  // 2) Webview Android générique : "; wv)" présent dans l'UA d'une WebView.
  if (isAndroid && /;\s*wv\)/i.test(s)) return { isInApp: true, app: null, isIOS, isAndroid }

  // 3) Webview iOS générique : Safari mobile SANS le token "Safari" (les vraies WebView WKWebView
  //    n'incluent pas "Safari"/"CriOS"/"FxiOS"). Heuristique prudente pour éviter les faux positifs.
  if (isIOS && /AppleWebKit/i.test(s) && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS/i.test(s)) {
    return { isInApp: true, app: null, isIOS, isAndroid }
  }

  return { isInApp: false, app: null, isIOS, isAndroid }
}

/** Raccourci booléen (client). */
export function isInAppBrowser(ua?: string): boolean {
  return detectInAppBrowser(ua).isInApp
}
