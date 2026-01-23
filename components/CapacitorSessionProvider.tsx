'use client'

import { useEffect, useState } from 'react'
import { isCapacitor, restoreCapacitorSession, isAndroid, hasCapacitorBridge } from '@/lib/capacitor'

interface CapacitorSessionProviderProps {
  children: React.ReactNode
}

/**
 * Configure la status bar Android
 * Utilise la couleur de la nav par défaut (#1e293b)
 */
async function configureStatusBar() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Status bar avec couleur de la nav (thème sombre)
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#1e293b' })
    // Sur Android, ne pas permettre le contenu sous la status bar
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch (e) {
    console.warn('[StatusBar] Configuration ignorée:', e)
  }
}

/**
 * Configure le listener pour restaurer la session quand l'app revient au premier plan
 */
async function setupAppStateListener(onResume: () => void) {
  if (!hasCapacitorBridge()) return

  try {
    const { App } = await import('@capacitor/app')
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Capacitor] App revenue au premier plan, restauration session...')
        onResume()
      }
    })
  } catch (e) {
    console.warn('[Capacitor] Listener appStateChange non configuré:', e)
  }
}

/**
 * Composant qui restaure la session Supabase depuis Capacitor Preferences
 * au démarrage de l'app mobile. Doit envelopper les enfants qui ont besoin
 * de l'authentification.
 */
export default function CapacitorSessionProvider({ children }: CapacitorSessionProviderProps) {
  const [isReady, setIsReady] = useState(!isCapacitor())

  useEffect(() => {
    if (isCapacitor()) {
      // Configurer la status bar sur Android
      if (isAndroid()) {
        configureStatusBar()
      }

      // Restaurer la session depuis Capacitor Preferences vers localStorage
      restoreCapacitorSession().then(() => {
        setIsReady(true)
      })

      // Configurer le listener pour restaurer la session quand l'app revient au premier plan
      setupAppStateListener(() => {
        restoreCapacitorSession()
      })
    }
  }, [])

  // Sur le web, afficher directement les enfants
  // Sur Capacitor, attendre que la session soit restaurée
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
      </div>
    )
  }

  return <>{children}</>
}
