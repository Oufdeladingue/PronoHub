/**
 * Utilitaires pour Capacitor (app mobile)
 */

// Détecter si on est dans l'app Capacitor
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
}

// Ouvrir une URL externe (Stripe, etc.)
export async function openExternalUrl(url: string): Promise<void> {
  if (isCapacitor()) {
    // Dans Capacitor, utiliser le plugin Browser pour ouvrir dans un navigateur in-app
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
  } else {
    // Sur le web, redirection classique
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
 * Stockage persistant pour Capacitor (utilisé par Supabase)
 * Utilise le plugin Preferences pour persister la session même après fermeture de l'app
 */
export function createCapacitorStorage() {
  return {
    getItem: async (key: string): Promise<string | null> => {
      if (isCapacitor()) {
        const { Preferences } = await import('@capacitor/preferences')
        const { value } = await Preferences.get({ key })
        return value
      }
      return localStorage.getItem(key)
    },
    setItem: async (key: string, value: string): Promise<void> => {
      if (isCapacitor()) {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.set({ key, value })
      } else {
        localStorage.setItem(key, value)
      }
    },
    removeItem: async (key: string): Promise<void> => {
      if (isCapacitor()) {
        const { Preferences } = await import('@capacitor/preferences')
        await Preferences.remove({ key })
      } else {
        localStorage.removeItem(key)
      }
    },
  }
}
