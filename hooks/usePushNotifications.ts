'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const NOTIFICATION_PROMPT_KEY = 'pronohub_notification_prompt_shown'

/**
 * Hook pour gérer les notifications push via Firebase Web SDK
 * Fonctionne dans le navigateur et dans les WebViews Android
 * La modale de permission ne s'affiche qu'après connexion
 */
export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
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

  // Demander la permission et initialiser Firebase
  const requestPermission = useCallback(async () => {
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
    }
  }, [saveTokenToDatabase])

  // Vérifier si l'utilisateur est connecté
  const checkAuthentication = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      return !!user
    } catch {
      setIsAuthenticated(false)
      return false
    }
  }, [supabase])

  // Vérifier si on doit afficher la modale
  const checkAndShowModal = useCallback(async () => {
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

    // Vérifier si l'utilisateur est connecté
    const userIsAuthenticated = await checkAuthentication()
    if (!userIsAuthenticated) {
      console.log('[Push] Utilisateur non connecté, modale différée')
      setIsLoading(false)
      return
    }

    // Si la permission est déjà accordée, initialiser directement
    if (Notification.permission === 'granted') {
      console.log('[Push] Permission déjà accordée')
      await requestPermission()
      setIsLoading(false)
      return
    }

    // Si la permission est refusée, ne pas afficher la modale
    if (Notification.permission === 'denied') {
      console.log('[Push] Permission refusée précédemment')
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    // Vérifier si on a déjà montré la modale
    const promptShown = localStorage.getItem(NOTIFICATION_PROMPT_KEY)
    if (promptShown) {
      console.log('[Push] Modale déjà affichée précédemment')
      setIsLoading(false)
      return
    }

    // Afficher notre modale personnalisée
    setShowPermissionModal(true)
    setIsLoading(false)
  }, [requestPermission, checkAuthentication])

  // Quand l'utilisateur accepte notre modale
  const handleAcceptPermission = useCallback(async () => {
    setShowPermissionModal(false)
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
    await requestPermission()
  }, [requestPermission])

  // Quand l'utilisateur refuse notre modale
  const handleDeclinePermission = useCallback(() => {
    setShowPermissionModal(false)
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
    setIsSupported(false)
  }, [])

  // Écouter les changements d'authentification
  useEffect(() => {
    // Vérifier au montage
    checkAndShowModal()

    // Écouter les changements de session (connexion/déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('[Push] Utilisateur connecté, vérification des notifications')
        setIsAuthenticated(true)
        // Petit délai pour laisser l'UI se charger après connexion
        setTimeout(() => {
          checkAndShowModal()
        }, 1500)
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setShowPermissionModal(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [checkAndShowModal, supabase.auth])

  return {
    token,
    isSupported,
    isLoading,
    isAuthenticated,
    showPermissionModal,
    handleAcceptPermission,
    handleDeclinePermission,
    reinitialize: checkAndShowModal,
  }
}
