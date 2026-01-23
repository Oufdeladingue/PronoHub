/**
 * Utilitaires pour Capacitor (app mobile)
 */

// Vérifier si le bridge Capacitor natif est disponible (plugins accessibles)
export function hasCapacitorBridge(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

// Détecter si on est dans l'app Capacitor/WebView Android
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false

  // Méthode 1: Vérifier l'objet Capacitor (fonctionne si chargé depuis les assets locaux)
  if (hasCapacitorBridge()) return true

  // Méthode 2: Détecter le WebView Android via User-Agent (fonctionne si chargé depuis URL externe)
  // Le WebView Android contient "wv" dans son User-Agent
  const userAgent = navigator.userAgent || ''
  const isAndroidWebView = /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)

  return isAndroidWebView
}

// Ouvrir une URL externe (Stripe, etc.)
export async function openExternalUrl(url: string): Promise<void> {
  // Si le bridge Capacitor est disponible, utiliser le plugin Browser
  if (hasCapacitorBridge()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url })
      return
    } catch {
      // Fallback si le plugin n'est pas disponible
    }
  }

  // Fallback: ouvrir dans un nouvel onglet (fonctionne dans WebView)
  if (isCapacitor()) {
    window.open(url, '_blank')
  } else {
    // Sur le web standard, redirection classique
    window.location.href = url
  }
}

/**
 * Faire une requête fetch avec le token d'auth Supabase (pour Capacitor)
 * Nécessaire car les cookies ne sont pas partagés dans le WebView Capacitor
 */
export async function capacitorFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (isCapacitor()) {
    // Récupérer le token depuis le stockage Capacitor
    const { Preferences } = await import('@capacitor/preferences')
    const { value } = await Preferences.get({ key: 'sb-auth-token' })

    if (value) {
      try {
        const session = JSON.parse(value)
        const accessToken = session?.access_token

        if (accessToken) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
          }
        }
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }

  return fetch(url, options)
}

/**
 * Stockage hybride pour Capacitor (utilisé par Supabase)
 * - Utilise localStorage pour les accès synchrones (requis par Supabase)
 * - Sauvegarde aussi dans Capacitor Preferences pour la persistance (si bridge disponible)
 */
export function createCapacitorStorage() {
  return {
    getItem: (key: string): string | null => {
      // Lecture synchrone depuis localStorage
      return localStorage.getItem(key)
    },
    setItem: (key: string, value: string): void => {
      // Écriture synchrone dans localStorage
      localStorage.setItem(key, value)
      // Sauvegarde async dans Capacitor Preferences (si bridge disponible)
      if (hasCapacitorBridge()) {
        import('@capacitor/preferences').then(({ Preferences }) => {
          Preferences.set({ key, value }).catch(() => {})
        }).catch(() => {})
      }
    },
    removeItem: (key: string): void => {
      // Suppression synchrone depuis localStorage
      localStorage.removeItem(key)
      // Suppression async dans Capacitor Preferences (si bridge disponible)
      if (hasCapacitorBridge()) {
        import('@capacitor/preferences').then(({ Preferences }) => {
          Preferences.remove({ key }).catch(() => {})
        }).catch(() => {})
      }
    },
  }
}

/**
 * Détecte si on est sur Android (Capacitor)
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false

  // Via Capacitor
  if (hasCapacitorBridge()) {
    const Capacitor = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
    return Capacitor?.getPlatform?.() === 'android'
  }

  // Fallback User-Agent
  return /Android/i.test(navigator.userAgent)
}

/**
 * Vérifie si Google Sign-In natif est disponible (Android avec bridge Capacitor)
 */
export function isNativeGoogleAuthAvailable(): boolean {
  return hasCapacitorBridge() && isAndroid()
}

/**
 * Restaurer la session depuis Capacitor Preferences vers localStorage
 * À appeler au démarrage de l'app Capacitor (uniquement si bridge disponible)
 *
 * IMPORTANT: Cette fonction restaure TOUJOURS depuis Preferences,
 * même si localStorage a déjà une valeur (car localStorage peut être vidé par Android)
 */
export async function restoreCapacitorSession(): Promise<void> {
  // Ne rien faire si le bridge Capacitor n'est pas disponible
  if (!hasCapacitorBridge()) return

  try {
    const { Preferences } = await import('@capacitor/preferences')

    // Récupérer toutes les clés stockées et restaurer celles liées à Supabase
    const { keys } = await Preferences.keys()

    for (const key of keys) {
      // Restaurer les clés qui commencent par 'sb-' (Supabase)
      if (key.startsWith('sb-')) {
        const { value } = await Preferences.get({ key })
        if (value) {
          // TOUJOURS écraser localStorage avec la valeur de Preferences
          // car localStorage peut avoir été vidé par Android lors d'un switch d'app
          localStorage.setItem(key, value)
        }
      }
    }

    console.log('[Capacitor] Session restaurée depuis Preferences')
  } catch (error) {
    console.error('[Capacitor] Erreur restauration session:', error)
  }
}
