'use client'

import { useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { hasCapacitorBridge } from '@/lib/capacitor'

interface PushNotificationsProviderProps {
  children: React.ReactNode
}

/**
 * Provider qui initialise les notifications push au démarrage de l'app
 * Doit être placé dans le layout après l'authentification
 */
export default function PushNotificationsProvider({ children }: PushNotificationsProviderProps) {
  const { token, isSupported, isLoading } = usePushNotifications()

  useEffect(() => {
    if (!isLoading) {
      if (isSupported) {
        console.log('[PushProvider] Notifications push initialisées, token:', token ? 'obtenu' : 'non obtenu')
      } else {
        console.log('[PushProvider] Notifications push non supportées (web ou bridge absent)')
      }
    }
  }, [token, isSupported, isLoading])

  // Ce provider ne modifie pas le rendu, il initialise juste les notifications
  return <>{children}</>
}
