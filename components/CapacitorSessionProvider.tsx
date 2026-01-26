'use client'

import { useEffect, useState } from 'react'
import {
  isCapacitor,
  restoreCapacitorSession,
  isAndroid,
  configureStatusBar,
  setupAppStateListener,
} from '@/lib/capacitor'

interface CapacitorSessionProviderProps {
  children: React.ReactNode
}

/**
 * Composant qui restaure la session Supabase depuis Capacitor Preferences
 * au démarrage de l'app mobile. Doit envelopper les enfants qui ont besoin
 * de l'authentification.
 */
export default function CapacitorSessionProvider({ children }: CapacitorSessionProviderProps) {
  const [isReady, setIsReady] = useState(!isCapacitor())

  useEffect(() => {
    async function initCapacitor() {
      console.log('[CapacitorSessionProvider] Initialisation...')
      console.log('[CapacitorSessionProvider] isCapacitor:', isCapacitor())
      console.log('[CapacitorSessionProvider] isAndroid:', isAndroid())

      if (isCapacitor()) {
        // Ajouter une classe CSS pour les fixes de layout spécifiques Android/Capacitor
        document.documentElement.classList.add('capacitor')

        // La status bar est configurée en noir nativement dans MainActivity.java

        // Restaurer la session depuis Capacitor Preferences vers localStorage
        console.log('[CapacitorSessionProvider] Restauration session...')
        await restoreCapacitorSession()

        // Set le flag global pour indiquer que la session est restaurée
        if (typeof window !== 'undefined') {
          (window as any).__capacitorSessionRestored = true
          console.log('[CapacitorSessionProvider] Flag __capacitorSessionRestored set to true')
        }

        setIsReady(true)

        // Configurer le listener pour restaurer la session quand l'app revient au premier plan
        await setupAppStateListener(() => {
          restoreCapacitorSession()
        })
      }
    }

    initCapacitor()
  }, [])

  // Sur le web, afficher directement les enfants
  // Sur Capacitor, attendre que la session soit restaurée
  if (!isReady) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
      </div>
    )
  }

  return <>{children}</>
}
