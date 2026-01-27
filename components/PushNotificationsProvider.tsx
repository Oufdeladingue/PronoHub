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

  // Notifications push gérées automatiquement par le hook

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
