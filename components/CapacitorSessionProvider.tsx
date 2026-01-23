'use client'

import { useEffect, useState } from 'react'
import { isCapacitor, restoreCapacitorSession, isAndroid } from '@/lib/capacitor'

interface CapacitorSessionProviderProps {
  children: React.ReactNode
}

/**
 * Configure la status bar Android pour être transparente
 */
async function configureStatusBar() {
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // Status bar transparente avec texte clair
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0f172a' })
    // Sur Android, permettre au contenu de passer sous la status bar
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch (e) {
    console.warn('[StatusBar] Configuration ignorée:', e)
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
