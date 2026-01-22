'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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

  // Utiliser useRef pour éviter les recreations de supabase
  const supabaseRef = useRef(createClient())
  const initializedRef = useRef(false)

  // Enregistrer le token FCM dans la base de données
  const saveTokenToDatabase = useCallback(async (fcmToken: string) => {
    try {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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
  }, [])

  // Demander la permission et initialiser Firebase
  const requestPermission = useCallback(async () => {
    try {
      const {
        requestNotificationPermission,
        registerServiceWorker,
        onForegroundMessage
      } = await import('@/lib/firebase-web')

      await registerServiceWorker()
      const fcmToken = await requestNotificationPermission()

      if (fcmToken) {
        setToken(fcmToken)
        setIsSupported(true)
        await saveTokenToDatabase(fcmToken)

        onForegroundMessage((payload) => {
          console.log('[Push] Message en premier plan:', payload)
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

  // Vérifier si on doit afficher la modale
  const checkAndShowModal = useCallback(async () => {
    if (typeof window === 'undefined') {
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('[Push] Notifications ou Service Worker non supportés')
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    // Vérifier si l'utilisateur est connecté
    try {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.log('[Push] Utilisateur non connecté, modale différée')
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      setIsAuthenticated(true)
    } catch {
      setIsAuthenticated(false)
      setIsLoading(false)
      return
    }

    if (Notification.permission === 'granted') {
      console.log('[Push] Permission déjà accordée')
      await requestPermission()
      setIsLoading(false)
      return
    }

    if (Notification.permission === 'denied') {
      console.log('[Push] Permission refusée précédemment')
      setIsSupported(false)
      setIsLoading(false)
      return
    }

    const promptShown = localStorage.getItem(NOTIFICATION_PROMPT_KEY)
    if (promptShown) {
      console.log('[Push] Modale déjà affichée précédemment')
      setIsLoading(false)
      return
    }

    setShowPermissionModal(true)
    setIsLoading(false)
  }, [requestPermission])

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

  // Initialiser une seule fois au montage
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const supabase = supabaseRef.current

    // Vérifier au montage
    checkAndShowModal()

    // Écouter les changements de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('[Push] Utilisateur connecté, vérification des notifications')
        setIsAuthenticated(true)
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
  }, [checkAndShowModal])

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
