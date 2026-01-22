'use client'

import { useEffect } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import NotificationPermissionModal from './NotificationPermissionModal'

interface PushNotificationsProviderProps {
  children: React.ReactNode
}

/**
 * Provider qui initialise les notifications push via Firebase Web SDK
 * Affiche une modale personnalisée avant de demander la permission système
 */
export default function PushNotificationsProvider({ children }: PushNotificationsProviderProps) {
  const {
    token,
    isSupported,
    isLoading,
    showPermissionModal,
    handleAcceptPermission,
    handleDeclinePermission,
  } = usePushNotifications()

  useEffect(() => {
    if (!isLoading) {
      if (isSupported && token) {
        console.log('[PushProvider] Notifications push initialisées avec Firebase Web SDK')
      } else if (!isSupported && !showPermissionModal) {
        console.log('[PushProvider] Notifications push non disponibles')
      }
    }
  }, [token, isSupported, isLoading, showPermissionModal])

  return (
    <>
      {children}
      {showPermissionModal && (
        <NotificationPermissionModal
          onAccept={handleAcceptPermission}
          onDecline={handleDeclinePermission}
        />
      )}
    </>
  )
}
