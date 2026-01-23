'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isCapacitor } from '@/lib/capacitor'

const NOTIFICATION_PROMPT_KEY = 'pronohub_notification_prompt_shown'

/**
 * Hook pour gérer les notifications push
 * - Capacitor uniquement: utilise le plugin natif @capacitor/push-notifications
 * - La modale de permission n'est affichée que sur mobile (Capacitor)
 */
export function usePushNotifications() {
  const [token, setToken] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const supabaseRef = useRef(createClient())
  const hasInitialized = useRef(false)
  const isProcessing = useRef(false)
  const checkCount = useRef(0)

  // Fonction pour sauvegarder le token
  const saveToken = async (fcmToken: string) => {
    try {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('profiles')
        .update({ fcm_token: fcmToken })
        .eq('id', user.id)

      console.log('[Push] Token enregistré')
    } catch (error) {
      console.error('[Push] Erreur sauvegarde token:', error)
    }
  }

  // Fonction pour demander la permission
  const requestPermission = async () => {
    if (isProcessing.current) return
    isProcessing.current = true

    try {
      if (isCapacitor()) {
        // Dans Capacitor, utiliser le plugin natif
        const { PushNotifications } = await import('@capacitor/push-notifications')

        const result = await PushNotifications.requestPermissions()
        console.log('[Push] Permission result:', result.receive)

        if (result.receive === 'granted') {
          await PushNotifications.register()

          // Écouter le token
          PushNotifications.addListener('registration', async (tokenData) => {
            console.log('[Push] Token natif obtenu:', tokenData.value.substring(0, 20) + '...')
            setToken(tokenData.value)
            setIsSupported(true)
            await saveToken(tokenData.value)
          })

          PushNotifications.addListener('registrationError', (error) => {
            console.error('[Push] Erreur registration:', error)
            setIsSupported(false)
          })
        } else {
          setIsSupported(false)
        }
      } else {
        // Sur le web, utiliser Firebase Web SDK
        const { requestNotificationPermission, registerServiceWorker } = await import('@/lib/firebase-web')
        await registerServiceWorker()
        const fcmToken = await requestNotificationPermission()

        if (fcmToken) {
          setToken(fcmToken)
          setIsSupported(true)
          await saveToken(fcmToken)
        } else {
          setIsSupported(false)
        }
      }
    } catch (error) {
      console.error('[Push] Erreur:', error)
      setIsSupported(false)
    } finally {
      isProcessing.current = false
    }
  }

  // Vérifier le statut des permissions
  const checkPermissionStatus = async (): Promise<'granted' | 'denied' | 'default'> => {
    if (isCapacitor()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const status = await PushNotifications.checkPermissions()
        console.log('[Push] Capacitor permission status:', status.receive)
        return status.receive as 'granted' | 'denied' | 'default'
      } catch {
        return 'default'
      }
    } else if ('Notification' in window) {
      return Notification.permission
    }
    return 'denied' // Pas de support
  }

  // Fonction principale de vérification
  const checkNotifications = async (retryIfNoUser = true) => {
    if (typeof window === 'undefined') return

    const inCapacitor = isCapacitor()
    console.log('[Push] Check notifications, isCapacitor:', inCapacitor)

    // Les notifications push ne sont activées que dans l'app Capacitor (Android/iOS)
    // Sur le web, on ne demande pas les permissions car moins pertinent
    if (!inCapacitor) {
      console.log('[Push] Pas dans Capacitor, notifications désactivées sur web')
      setIsLoading(false)
      return
    }

    // Vérifier l'authentification
    try {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()

      console.log('[Push] Check notifications, user:', user?.email || 'non connecté')

      if (!user) {
        setIsAuthenticated(false)

        // Dans Capacitor, la session peut prendre du temps à se restaurer
        // Réessayer quelques fois avec un délai
        if (retryIfNoUser && checkCount.current < 3) {
          checkCount.current++
          console.log('[Push] Pas de user, retry', checkCount.current)
          setTimeout(() => checkNotifications(true), 2000)
          return
        }

        setIsLoading(false)
        return
      }

      setIsAuthenticated(true)
      checkCount.current = 0 // Reset le compteur

      // Vérifier le statut des permissions
      const permissionStatus = await checkPermissionStatus()

      // Si permission déjà accordée
      if (permissionStatus === 'granted') {
        console.log('[Push] Permission déjà accordée')
        await requestPermission()
        setIsLoading(false)
        return
      }

      // Si permission refusée
      if (permissionStatus === 'denied') {
        console.log('[Push] Permission refusée')
        setIsLoading(false)
        return
      }

      // Vérifier si modale déjà affichée
      if (localStorage.getItem(NOTIFICATION_PROMPT_KEY)) {
        console.log('[Push] Modale déjà affichée précédemment')
        setIsLoading(false)
        return
      }

      // Afficher la modale
      console.log('[Push] Affichage de la modale')
      setShowPermissionModal(true)
      setIsLoading(false)
    } catch (error) {
      console.error('[Push] Erreur check:', error)
      setIsLoading(false)
    }
  }

  // Handlers pour la modale
  const handleAcceptPermission = async () => {
    setShowPermissionModal(false)
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
    await requestPermission()
  }

  const handleDeclinePermission = () => {
    setShowPermissionModal(false)
    localStorage.setItem(NOTIFICATION_PROMPT_KEY, 'true')
  }

  // Effet d'initialisation - une seule fois
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const supabase = supabaseRef.current

    // Écouter les changements d'auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Push] Auth state change:', event, session?.user?.email)

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          // Délai pour laisser le dashboard se charger
          setTimeout(() => checkNotifications(false), 3000)
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setShowPermissionModal(false)
      }
    })

    // Check initial avec retry pour Capacitor
    setTimeout(() => checkNotifications(true), 1000)

    return () => subscription.unsubscribe()
  }, [])

  return {
    token,
    isSupported,
    isLoading,
    isAuthenticated,
    showPermissionModal,
    handleAcceptPermission,
    handleDeclinePermission,
    reinitialize: checkNotifications,
  }
}
