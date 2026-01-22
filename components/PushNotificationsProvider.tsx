'use client'

import { useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface PushNotificationsProviderProps {
  children: React.ReactNode
}

/**
 * Provider qui initialise les notifications push via Firebase Web SDK
 * Fonctionne dans le navigateur et dans les WebViews Android
 */
export default function PushNotificationsProvider({ children }: PushNotificationsProviderProps) {
  const { token, isSupported, isLoading } = usePushNotifications()

  useEffect(() => {
    if (!isLoading) {
      if (isSupported && token) {
        console.log('[PushProvider] Notifications push initialisées avec Firebase Web SDK')
      } else if (!isSupported) {
        console.log('[PushProvider] Notifications push non supportées sur ce navigateur')
      }
    }
  }, [token, isSupported, isLoading])

  // Ce provider ne modifie pas le rendu, il initialise juste les notifications
  return <>{children}</>
}
