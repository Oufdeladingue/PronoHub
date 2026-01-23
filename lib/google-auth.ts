/**
 * Service Google Sign-In natif pour Capacitor Android
 * Utilise @codetrix-studio/capacitor-google-auth via le bridge natif
 *
 * IMPORTANT: Quand l'APK charge depuis une URL externe (Vercel),
 * on doit utiliser Capacitor.Plugins.GoogleAuth au lieu d'imports npm.
 */

export interface GoogleUser {
  id: string
  email: string
  name: string
  givenName: string
  familyName: string
  imageUrl: string
  authentication: {
    accessToken: string
    idToken: string
    refreshToken?: string
  }
}

// Interface pour le plugin GoogleAuth via Capacitor.Plugins
interface GoogleAuthPlugin {
  initialize: (options: { clientId: string; scopes: string[]; grantOfflineAccess: boolean }) => Promise<void>
  signIn: () => Promise<GoogleUser>
  signOut: () => Promise<void>
  refresh: () => Promise<{ accessToken: string; idToken: string }>
}

// Accès au plugin via Capacitor.Plugins
function getGoogleAuthPlugin(): GoogleAuthPlugin | null {
  if (typeof window === 'undefined') return null
  const Capacitor = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean
      Plugins?: { GoogleAuth?: GoogleAuthPlugin }
    }
  }).Capacitor
  return Capacitor?.Plugins?.GoogleAuth || null
}

let isInitialized = false

/**
 * Initialise le plugin Google Auth (à appeler au démarrage de l'app Capacitor)
 */
export async function initGoogleAuth(): Promise<void> {
  if (isInitialized) return

  const GoogleAuth = getGoogleAuthPlugin()
  if (!GoogleAuth) {
    console.log('[GoogleAuth] Plugin non disponible')
    return
  }

  try {
    // Initialisation avec les scopes
    await GoogleAuth.initialize({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      scopes: ['profile', 'email'],
      grantOfflineAccess: true,
    })

    isInitialized = true
    console.log('[GoogleAuth] Plugin initialisé avec succès')
  } catch (error) {
    console.error('[GoogleAuth] Erreur initialisation:', error)
  }
}

/**
 * Déclenche le Google Sign-In natif
 * @returns GoogleUser avec idToken pour Supabase
 */
export async function signInWithGoogleNative(): Promise<GoogleUser> {
  const GoogleAuth = getGoogleAuthPlugin()

  if (!GoogleAuth) {
    // Tenter l'initialisation si pas encore fait
    await initGoogleAuth()
  }

  const plugin = getGoogleAuthPlugin()
  if (!plugin) {
    throw new Error('GoogleAuth non disponible. Le plugin n\'a pas pu être initialisé.')
  }

  try {
    const user = await plugin.signIn()

    if (!user.authentication?.idToken) {
      throw new Error('Pas d\'idToken reçu de Google')
    }

    console.log('[GoogleAuth] Connexion réussie pour:', user.email)
    return user as GoogleUser
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Gérer l'annulation par l'utilisateur
    if (
      errorMessage.includes('canceled') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('user_cancelled') ||
      errorMessage.includes('12501') // Code erreur Google pour annulation
    ) {
      throw new Error('Connexion annulée')
    }

    console.error('[GoogleAuth] Erreur sign-in:', error)
    throw error
  }
}

/**
 * Déconnexion Google
 */
export async function signOutGoogle(): Promise<void> {
  const plugin = getGoogleAuthPlugin()
  if (!plugin) return

  try {
    await plugin.signOut()
    console.log('[GoogleAuth] Déconnexion Google effectuée')
  } catch (error) {
    console.error('[GoogleAuth] Erreur déconnexion:', error)
  }
}

/**
 * Rafraîchir le token Google (si disponible)
 * Retourne uniquement les tokens d'authentification
 */
export async function refreshGoogleToken(): Promise<{ accessToken: string; idToken: string } | null> {
  const plugin = getGoogleAuthPlugin()
  if (!plugin) return null

  try {
    const authentication = await plugin.refresh()
    return {
      accessToken: authentication.accessToken,
      idToken: authentication.idToken,
    }
  } catch (error) {
    console.error('[GoogleAuth] Erreur refresh:', error)
    return null
  }
}

/**
 * Vérifie si Google Sign-In natif est disponible
 */
export function isGoogleAuthAvailable(): boolean {
  return getGoogleAuthPlugin() !== null && isInitialized
}
