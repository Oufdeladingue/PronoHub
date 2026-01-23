/**
 * Firebase Admin SDK pour l'envoi de notifications push côté serveur
 */

import admin from 'firebase-admin'

// Initialiser Firebase Admin si pas déjà fait
if (!admin.apps.length) {
  // Les credentials peuvent être passés via variable d'environnement
  let serviceAccount = null

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      let keyValue = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

      // Nettoyer la valeur si elle est entourée de guillemets
      if (keyValue.startsWith('"') && keyValue.endsWith('"')) {
        keyValue = keyValue.slice(1, -1)
      }
      if (keyValue.startsWith("'") && keyValue.endsWith("'")) {
        keyValue = keyValue.slice(1, -1)
      }

      // Parser le JSON
      serviceAccount = JSON.parse(keyValue)
      console.log('[Firebase Admin] Service account chargé pour projet:', serviceAccount.project_id)
    } catch (e) {
      console.error('[Firebase Admin] Erreur parsing FIREBASE_SERVICE_ACCOUNT_KEY:', e)
      console.error('[Firebase Admin] Valeur (premiers 100 chars):', process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.substring(0, 100))
    }
  } else {
    console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY non défini')
  }

  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('[Firebase Admin] Initialisé avec succès')
    } catch (e) {
      console.error('[Firebase Admin] Erreur initialisation:', e)
    }
  } else {
    console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY non configuré ou invalide, notifications push désactivées')
  }
}

export const firebaseAdmin = admin

/**
 * Types de notifications
 */
export type NotificationType =
  | 'reminder'           // Rappel pronostics non renseignés
  | 'tournament_started' // Tournoi lancé
  | 'day_recap'          // Récap journée
  | 'tournament_end'     // Fin de tournoi
  | 'invite'             // Invitation à un tournoi
  | 'player_joined'      // Joueur a rejoint (pour capitaine)

/**
 * Envoyer une notification push à un utilisateur
 */
export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!admin.apps.length) {
    console.warn('[Push] Firebase Admin non initialisé')
    return false
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification', // Icône de notification (à créer)
          color: '#ff9900', // Couleur PronoHub
          channelId: 'pronohub_default',
          sound: 'default',
        },
      },
    }

    const response = await admin.messaging().send(message)
    console.log('[Push] Notification envoyée:', response)
    return true
  } catch (error: any) {
    console.error('[Push] Erreur envoi notification:', error.code, error.message)

    // Si le token est invalide, on pourrait le supprimer de la base
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log('[Push] Token invalide, à supprimer:', fcmToken.substring(0, 20) + '...')
    }

    // Retourner l'erreur pour debug
    throw error
  }
}

/**
 * Envoyer une notification à plusieurs utilisateurs
 */
export async function sendPushNotificationToMany(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number }> {
  if (!admin.apps.length || fcmTokens.length === 0) {
    return { success: 0, failure: fcmTokens.length }
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          icon: 'ic_notification',
          color: '#ff9900',
          channelId: 'pronohub_default',
          sound: 'default',
        },
      },
    }

    const response = await admin.messaging().sendEachForMulticast(message)
    console.log(`[Push] Notifications envoyées: ${response.successCount} succès, ${response.failureCount} échecs`)

    return {
      success: response.successCount,
      failure: response.failureCount,
    }
  } catch (error) {
    console.error('[Push] Erreur envoi notifications multiples:', error)
    return { success: 0, failure: fcmTokens.length }
  }
}
