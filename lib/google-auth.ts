/**
 * Service Google Sign-In natif pour Capacitor Android
 * Utilise @codetrix-studio/capacitor-google-auth
 */

import { hasCapacitorBridge } from './capacitor'

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

// Variable pour stocker le module importé dynamiquement
let GoogleAuth: typeof import('@codetrix-studio/capacitor-google-auth').GoogleAuth | null = null
let isInitialized = false

/**
 * Initialise le plugin Google Auth (à appeler au démarrage de l'app Capacitor)
 */
export async function initGoogleAuth(): Promise<void> {
  if (!hasCapacitorBridge() || isInitialized) return

  try {
    const module = await import('@codetrix-studio/capacitor-google-auth')
    GoogleAuth = module.GoogleAuth

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
  if (!GoogleAuth) {
    // Tenter l'initialisation si pas encore fait
    await initGoogleAuth()
  }

  if (!GoogleAuth) {
    throw new Error('GoogleAuth non disponible. Le plugin n\'a pas pu être initialisé.')
  }

  try {
    const user = await GoogleAuth.signIn()

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
  if (!GoogleAuth) return

  try {
    await GoogleAuth.signOut()
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
  if (!GoogleAuth) return null

  try {
    const authentication = await GoogleAuth.refresh()
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
  return hasCapacitorBridge() && isInitialized
}
