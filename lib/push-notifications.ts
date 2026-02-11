/**
 * Gestion des notifications push avec Capacitor
 */

import { hasCapacitorBridge } from './capacitor'

let pushNotificationsModule: typeof import('@capacitor/push-notifications') | null = null

/**
 * Initialiser les notifications push
 * Doit être appelé au démarrage de l'app (après login)
 */
export async function initPushNotifications(): Promise<string | null> {
  // Ne fonctionne que si le bridge Capacitor est disponible
  if (!hasCapacitorBridge()) {
    return null
  }

  try {
    // Import dynamique du module
    if (!pushNotificationsModule) {
      pushNotificationsModule = await import('@capacitor/push-notifications')
    }
    const { PushNotifications } = pushNotificationsModule

    // Vérifier les permissions
    let permStatus = await PushNotifications.checkPermissions()

    if (permStatus.receive === 'prompt') {
      // Demander la permission
      permStatus = await PushNotifications.requestPermissions()
    }

    if (permStatus.receive !== 'granted') {
      return null
    }

    // Enregistrer pour recevoir les notifications
    await PushNotifications.register()

    // Écouter l'événement de registration pour obtenir le token
    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value)
      })

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Erreur registration:', error)
        resolve(null)
      })

      // Timeout après 10 secondes
      setTimeout(() => resolve(null), 10000)
    })
  } catch (error) {
    console.error('[Push] Erreur initialisation:', error)
    return null
  }
}

/**
 * Configurer les listeners de notifications
 */
export async function setupPushListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationTapped?: (notification: any) => void
): Promise<void> {
  if (!hasCapacitorBridge()) return

  try {
    if (!pushNotificationsModule) {
      pushNotificationsModule = await import('@capacitor/push-notifications')
    }
    const { PushNotifications } = pushNotificationsModule

    // Notification reçue pendant que l'app est au premier plan
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      onNotificationReceived?.(notification)
    })

    // L'utilisateur a tapé sur la notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      onNotificationTapped?.(action.notification)
    })
  } catch (error) {
    console.error('[Push] Erreur setup listeners:', error)
  }
}

/**
 * Supprimer tous les listeners
 */
export async function removePushListeners(): Promise<void> {
  if (!hasCapacitorBridge()) return

  try {
    if (!pushNotificationsModule) {
      pushNotificationsModule = await import('@capacitor/push-notifications')
    }
    const { PushNotifications } = pushNotificationsModule
    await PushNotifications.removeAllListeners()
  } catch (error) {
    console.error('[Push] Erreur remove listeners:', error)
  }
}
