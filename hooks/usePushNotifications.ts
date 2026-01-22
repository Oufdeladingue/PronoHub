'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Hook pour gérer les notifications push via Firebase Web SDK
 * Fonctionne dans le navigateur et dans les WebViews Android
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

  // Initialiser les notifications via Firebase Web SDK
  const initialize = useCallback(async () => {
    // Vérifier si on est côté client
    if (typeof window === 'undefined') {
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    // Vérifier si les notifications sont supportées
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('[Push] Notifications ou Service Worker non supportés')
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      // Import dynamique pour éviter les erreurs SSR
      const {
        requestNotificationPermission,
        registerServiceWorker,
        onForegroundMessage
      } = await import('@/lib/firebase-web')

      // Enregistrer le Service Worker
      await registerServiceWorker()

      // Demander la permission et obtenir le token
      const fcmToken = await requestNotificationPermission()

      if (fcmToken) {
        setToken(fcmToken)
        setIsSupported(true)
        await saveTokenToDatabase(fcmToken)

        // Configurer le listener pour les messages en premier plan
        onForegroundMessage((payload) => {
          console.log('[Push] Message en premier plan:', payload)

          // Afficher une notification native même en premier plan
          if (Notification.permission === 'granted' && payload.notification) {
            new Notification(payload.notification.title || 'PronoHub', {
              body: payload.notification.body,
              icon: '/images/logo.svg',
            })
          }
        })
      } else {
        setIsSupported(false)
      }
    } catch (error) {
      console.error('[Push] Erreur initialisation Firebase Web:', error)
      setIsSupported(false)
    } finally {
      setIsLoading(false)
    }
  }, [saveTokenToDatabase])

  // Initialiser au montage du composant
  useEffect(() => {
    initialize()
  }, [initialize])

  return {
    token,
    isSupported,
    isLoading,
    reinitialize: initialize,
  }
}
