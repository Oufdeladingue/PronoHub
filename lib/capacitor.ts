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
 * Stockage hybride pour Capacitor (utilisé par Supabase)
 * - Utilise localStorage pour les accès synchrones (requis par Supabase)
 * - Sauvegarde aussi dans Capacitor Preferences pour la persistance après fermeture de l'app
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
      // Sauvegarde async dans Capacitor Preferences (pour persistance)
      if (isCapacitor()) {
        import('@capacitor/preferences').then(({ Preferences }) => {
          Preferences.set({ key, value })
        })
      }
    },
    removeItem: (key: string): void => {
      // Suppression synchrone depuis localStorage
      localStorage.removeItem(key)
      // Suppression async dans Capacitor Preferences
      if (isCapacitor()) {
        import('@capacitor/preferences').then(({ Preferences }) => {
          Preferences.remove({ key })
        })
      }
    },
  }
}

/**
 * Restaurer la session depuis Capacitor Preferences vers localStorage
 * À appeler au démarrage de l'app Capacitor
 */
export async function restoreCapacitorSession(): Promise<void> {
  if (!isCapacitor()) return

  const { Preferences } = await import('@capacitor/preferences')

  // Chercher les clés de session Supabase dans Preferences
  // Le format standard est sb-<project-ref>-auth-token
  const keysToRestore = [
    'sb-auth-token',
    // Ajouter d'autres patterns si nécessaire
  ]

  // Récupérer toutes les clés stockées et restaurer celles liées à Supabase
  const { keys } = await Preferences.keys()

  for (const key of keys) {
    // Restaurer les clés qui commencent par 'sb-' (Supabase)
    if (key.startsWith('sb-')) {
      const { value } = await Preferences.get({ key })
      if (value && !localStorage.getItem(key)) {
        localStorage.setItem(key, value)
      }
    }
  }
}
