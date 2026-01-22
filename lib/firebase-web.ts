/**
 * Firebase Web SDK pour les notifications push
 * Fonctionne dans le navigateur et dans les WebViews Android
 */

import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging'

// Configuration Firebase Web
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialiser Firebase (une seule fois)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

let messaging: Messaging | null = null

/**
 * Obtenir l'instance de Firebase Messaging
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null

  // Vérifier si Firebase Messaging est supporté
  const supported = await isSupported()
  if (!supported) {
    console.log('[Firebase Web] Messaging non supporté sur ce navigateur')
    return null
  }

  if (!messaging) {
    messaging = getMessaging(app)
  }

  return messaging
}

/**
 * Demander la permission et obtenir le token FCM
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Vérifier si les notifications sont supportées
    if (!('Notification' in window)) {
      console.log('[Firebase Web] Notifications non supportées')
      return null
    }

    // Demander la permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('[Firebase Web] Permission refusée')
      return null
    }

    const messaging = await getFirebaseMessaging()
    if (!messaging) return null

    // Obtenir le token avec la clé VAPID
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    })

    console.log('[Firebase Web] Token FCM obtenu:', token.substring(0, 20) + '...')
    return token
  } catch (error) {
    console.error('[Firebase Web] Erreur obtention token:', error)
    return null
  }
}

/**
 * Écouter les messages en premier plan
 */
export function onForegroundMessage(callback: (payload: any) => void): () => void {
  let unsubscribe: () => void = () => {}

  getFirebaseMessaging().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[Firebase Web] Message reçu en premier plan:', payload)
        callback(payload)
      })
    }
  })

  return () => unsubscribe()
}

/**
 * Enregistrer le Service Worker pour les notifications en arrière-plan
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[Firebase Web] Service Worker non supporté')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    console.log('[Firebase Web] Service Worker enregistré:', registration.scope)
    return registration
  } catch (error) {
    console.error('[Firebase Web] Erreur enregistrement Service Worker:', error)
    return null
  }
}
