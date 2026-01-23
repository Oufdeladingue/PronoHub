/**
 * Utilitaires pour Capacitor (app mobile)
 *
 * IMPORTANT: Quand l'APK charge depuis une URL externe (Vercel),
 * les imports npm des plugins ne fonctionnent pas. On utilise donc
 * l'API native via window.Capacitor.Plugins.
 */

// Type pour l'objet Capacitor global
interface CapacitorGlobal {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
  Plugins?: {
    StatusBar?: {
      setStyle: (options: { style: string }) => Promise<void>
      setBackgroundColor: (options: { color: string }) => Promise<void>
      setOverlaysWebView: (options: { overlay: boolean }) => Promise<void>
    }
    Preferences?: {
      get: (options: { key: string }) => Promise<{ value: string | null }>
      set: (options: { key: string; value: string }) => Promise<void>
      remove: (options: { key: string }) => Promise<void>
      keys: () => Promise<{ keys: string[] }>
    }
    App?: {
      addListener: (event: string, callback: (state: { isActive: boolean }) => void) => Promise<{ remove: () => void }>
    }
    Browser?: {
      open: (options: { url: string }) => Promise<void>
    }
  }
}

// Accès à l'objet Capacitor global
function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor || null
}

// Vérifier si le bridge Capacitor natif est disponible (plugins accessibles)
export function hasCapacitorBridge(): boolean {
  const cap = getCapacitor()
  return cap?.isNativePlatform?.() === true
}

// Détecter si on est dans l'app Capacitor/WebView Android
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false

  // Méthode 1: Vérifier l'objet Capacitor (fonctionne si chargé depuis les assets locaux ou URL externe)
  if (hasCapacitorBridge()) return true

  // Méthode 2: Détecter le WebView Android via User-Agent (fallback)
  // Le WebView Android contient "wv" dans son User-Agent
  const userAgent = navigator.userAgent || ''
  const isAndroidWebView = /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)

  return isAndroidWebView
}

// Ouvrir une URL externe (Stripe, etc.)
export async function openExternalUrl(url: string): Promise<void> {
  // Si le bridge Capacitor est disponible, utiliser le plugin Browser natif
  const cap = getCapacitor()
  if (cap?.Plugins?.Browser) {
    try {
      await cap.Plugins.Browser.open({ url })
      return
    } catch {
      // Fallback si le plugin échoue
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
  const cap = getCapacitor()
  if (cap?.Plugins?.Preferences) {
    // Récupérer le token depuis le stockage Capacitor natif
    try {
      const { value } = await cap.Plugins.Preferences.get({ key: 'sb-auth-token' })

      if (value) {
        const session = JSON.parse(value)
        const accessToken = session?.access_token

        if (accessToken) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`,
          }
        }
      }
    } catch {
      // Ignorer les erreurs
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
      // Sauvegarde async dans Capacitor Preferences natif (si disponible)
      const cap = getCapacitor()
      if (cap?.Plugins?.Preferences) {
        cap.Plugins.Preferences.set({ key, value }).catch(() => {})
      }
    },
    removeItem: (key: string): void => {
      // Suppression synchrone depuis localStorage
      localStorage.removeItem(key)
      // Suppression async dans Capacitor Preferences natif (si disponible)
      const cap = getCapacitor()
      if (cap?.Plugins?.Preferences) {
        cap.Plugins.Preferences.remove({ key }).catch(() => {})
      }
    },
  }
}

/**
 * Détecte si on est sur Android (Capacitor)
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false

  // Via Capacitor natif
  const cap = getCapacitor()
  if (cap?.getPlatform) {
    return cap.getPlatform() === 'android'
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
 * Change la couleur de la status bar Android
 * @param color - Couleur hexadécimale (ex: '#1e293b' pour nav, '#000000' pour pages auth)
 */
export async function setStatusBarColor(color: string): Promise<void> {
  if (!isAndroid()) return

  const cap = getCapacitor()
  if (cap?.Plugins?.StatusBar) {
    try {
      await cap.Plugins.StatusBar.setBackgroundColor({ color })
      console.log(`[StatusBar] Couleur changée: ${color}`)
    } catch (e) {
      console.warn('[StatusBar] Erreur setBackgroundColor:', e)
    }
  }
}

/**
 * Restaurer la session depuis Capacitor Preferences vers localStorage
 * À appeler au démarrage de l'app Capacitor (uniquement si bridge disponible)
 *
 * IMPORTANT: Cette fonction restaure TOUJOURS depuis Preferences,
 * même si localStorage a déjà une valeur (car localStorage peut être vidé par Android)
 */
export async function restoreCapacitorSession(): Promise<void> {
  const cap = getCapacitor()
  const prefs = cap?.Plugins?.Preferences

  if (!prefs) {
    console.log('[Capacitor] Preferences plugin non disponible')
    return
  }

  try {
    // Récupérer toutes les clés stockées et restaurer celles liées à Supabase
    const { keys } = await prefs.keys()
    let restored = 0

    for (const key of keys) {
      // Restaurer les clés qui commencent par 'sb-' (Supabase)
      // Format: sb-{projectId}-auth-token ou sb-{url}-auth-token
      if (key.startsWith('sb-')) {
        const { value } = await prefs.get({ key })
        if (value) {
          // TOUJOURS écraser localStorage avec la valeur de Preferences
          // car localStorage peut avoir été vidé par Android lors d'un switch d'app
          localStorage.setItem(key, value)
          restored++
          console.log(`[Capacitor] Clé restaurée: ${key}`)
        }
      }
    }

    console.log(`[Capacitor] Session restaurée: ${restored} clé(s) depuis Preferences`)
  } catch (error) {
    console.error('[Capacitor] Erreur restauration session:', error)
  }
}

/**
 * Forcer la sauvegarde immédiate de toutes les clés Supabase dans Preferences
 * Utile après un login réussi
 */
export async function saveSessionToPreferences(): Promise<void> {
  const cap = getCapacitor()
  const prefs = cap?.Plugins?.Preferences

  if (!prefs) {
    console.log('[Capacitor] Preferences plugin non disponible pour sauvegarde')
    return
  }

  try {
    // Parcourir localStorage et sauvegarder toutes les clés Supabase
    let saved = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('sb-')) {
        const value = localStorage.getItem(key)
        if (value) {
          await prefs.set({ key, value })
          saved++
          console.log(`[Capacitor] Clé sauvegardée: ${key}`)
        }
      }
    }
    console.log(`[Capacitor] Session sauvegardée: ${saved} clé(s) dans Preferences`)
  } catch (error) {
    console.error('[Capacitor] Erreur sauvegarde session:', error)
  }
}

/**
 * Configure le listener pour restaurer la session quand l'app revient au premier plan
 */
export async function setupAppStateListener(onResume: () => void): Promise<void> {
  const cap = getCapacitor()
  const appPlugin = cap?.Plugins?.App

  if (!appPlugin) {
    console.log('[Capacitor] App plugin non disponible')
    return
  }

  try {
    await appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Capacitor] App revenue au premier plan, restauration session...')
        onResume()
      }
    })
    console.log('[Capacitor] Listener appStateChange configuré')
  } catch (e) {
    console.warn('[Capacitor] Erreur configuration listener:', e)
  }
}

/**
 * Configure la status bar Android avec les paramètres par défaut
 */
export async function configureStatusBar(color: string = '#1e293b'): Promise<void> {
  if (!isAndroid()) return

  const cap = getCapacitor()
  const statusBar = cap?.Plugins?.StatusBar

  if (!statusBar) {
    console.log('[StatusBar] Plugin non disponible')
    return
  }

  try {
    // Style Dark = texte blanc sur fond sombre
    await statusBar.setStyle({ style: 'DARK' })
    await statusBar.setBackgroundColor({ color })
    // Ne pas permettre le contenu sous la status bar
    await statusBar.setOverlaysWebView({ overlay: false })
    console.log(`[StatusBar] Configurée avec couleur ${color}`)
  } catch (e) {
    console.warn('[StatusBar] Erreur configuration:', e)
  }
}
