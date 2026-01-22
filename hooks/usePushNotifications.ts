'use client'

import { useEffect, useState, useCallback } from 'react'
import { hasCapacitorBridge } from '@/lib/capacitor'
import { initPushNotifications, setupPushListeners, removePushListeners } from '@/lib/push-notifications'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook pour gérer les notifications push
 * Initialise les notifications et enregistre le token FCM dans le profil utilisateur
 */
export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Enregistrer le token FCM dans la base de données
  const saveTokenToDatabase = useCallback(async (fcmToken: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Mettre à jour le profil avec le token FCM
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: fcmToken })
        .eq('id', user.id)

      if (error) {
        console.error('[Push] Erreur sauvegarde token:', error)
      } else {
        console.log('[Push] Token enregistré dans la base')
      }
    } catch (error) {
      console.error('[Push] Erreur sauvegarde token:', error)
    }
  }, [supabase])

  // Initialiser les notifications
  const initialize = useCallback(async () => {
    if (!hasCapacitorBridge()) {
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    setIsSupported(true)
    setIsLoading(true)

    try {
      // Initialiser et obtenir le token
      const fcmToken = await initPushNotifications()

      if (fcmToken) {
        setToken(fcmToken)
        await saveTokenToDatabase(fcmToken)
      }

      // Configurer les listeners
      await setupPushListeners(
        // Notification reçue (app au premier plan)
        (notification) => {
          console.log('[Push] Notification reçue en foreground:', notification)
          // TODO: Afficher une notification in-app si nécessaire
        },
        // Notification tapée
        (notification) => {
          console.log('[Push] Notification tapée:', notification)
          // TODO: Naviguer vers la page appropriée selon le type de notification
        }
      )
    } catch (error) {
      console.error('[Push] Erreur initialisation:', error)
    } finally {
      setIsLoading(false)
    }
  }, [saveTokenToDatabase])

  // Initialiser au montage du composant
  useEffect(() => {
    initialize()

    // Cleanup
    return () => {
      removePushListeners()
    }
  }, [initialize])

  return {
    token,
    isSupported,
    isLoading,
    reinitialize: initialize,
  }
}
