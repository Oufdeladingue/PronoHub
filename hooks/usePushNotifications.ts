'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const NOTIFICATION_PROMPT_KEY = 'pronohub_notification_prompt_shown'

/**
 * Hook pour gérer les notifications push via Firebase Web SDK
 * Version simplifiée pour éviter les boucles infinies
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
    } catch (error) {
      console.error('[Push] Erreur:', error)
      setIsSupported(false)
    } finally {
      isProcessing.current = false
    }
  }

  // Fonction principale de vérification
  const checkNotifications = async () => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window)) {
      setIsLoading(false)
      return
    }

    // Vérifier l'authentification
    try {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setIsAuthenticated(false)
        setIsLoading(false)
        return
      }

      setIsAuthenticated(true)

      // Si permission déjà accordée
      if (Notification.permission === 'granted') {
        await requestPermission()
        setIsLoading(false)
        return
      }

      // Si permission refusée
      if (Notification.permission === 'denied') {
        setIsLoading(false)
        return
      }

      // Vérifier si modale déjà affichée
      if (localStorage.getItem(NOTIFICATION_PROMPT_KEY)) {
        setIsLoading(false)
        return
      }

      // Afficher la modale
      setShowPermissionModal(true)
      setIsLoading(false)
    } catch {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setTimeout(checkNotifications, 2000)
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false)
        setShowPermissionModal(false)
      }
    })

    // Check initial
    checkNotifications()

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
