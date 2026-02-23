'use client'

import { useEffect, useState } from 'react'
import {
  isCapacitor,
  restoreCapacitorSession,
  saveSessionToPreferences,
  configureStatusBar,
  setupAppStateListener,
  setupDeepLinkListener,
  closeBrowser,
} from '@/lib/capacitor'
import { createClient } from '@/lib/supabase/client'

interface CapacitorSessionProviderProps {
  children: React.ReactNode
}

/**
 * Composant qui restaure la session Supabase depuis Capacitor Preferences
 * au démarrage de l'app mobile. Gère aussi le retour OAuth via deep link.
 */
export default function CapacitorSessionProvider({ children }: CapacitorSessionProviderProps) {
  const [isReady, setIsReady] = useState(!isCapacitor())

  useEffect(() => {
    async function initCapacitor() {
      if (isCapacitor()) {
        // Ajouter une classe CSS pour les fixes de layout spécifiques Android/Capacitor
        document.documentElement.classList.add('capacitor')

        // Restaurer la session depuis Capacitor Preferences vers localStorage
        await restoreCapacitorSession()

        // Set le flag global pour indiquer que la session est restaurée
        if (typeof window !== 'undefined') {
          (window as any).__capacitorSessionRestored = true
        }

        setIsReady(true)

        // Configurer le listener pour restaurer la session quand l'app revient au premier plan
        await setupAppStateListener(async () => {
          await restoreCapacitorSession()
          // Forcer un refresh du token (getUser() déclenche le refresh si expiré)
          try {
            const supabase = createClient()
            await supabase.auth.getUser()
          } catch {}
        })

        // Configurer le listener deep link pour le retour OAuth depuis le navigateur
        await setupDeepLinkListener(async (url: string) => {
          // Gérer pronohub://auth/callback?access_token=xxx&refresh_token=xxx&redirectTo=yyy
          if (url.includes('auth/callback')) {
            try {
              // Parser les paramètres (custom URL scheme, pas de URL standard)
              const queryString = url.split('?')[1]
              if (!queryString) return

              const params = new URLSearchParams(queryString)
              const accessToken = params.get('access_token')
              const refreshToken = params.get('refresh_token')
              const redirectTo = params.get('redirectTo') || '/dashboard'
              const error = params.get('error')

              // Fermer le navigateur externe
              await closeBrowser()

              // En cas d'erreur (ex: pays non autorisé)
              if (error) {
                window.location.href = `/auth/login?error=${encodeURIComponent(error)}`
                return
              }

              // Si on a les tokens, restaurer la session dans Supabase
              if (accessToken && refreshToken) {
                const supabase = createClient()
                const { error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                })

                if (sessionError) {
                  console.error('[Capacitor] Erreur setSession:', sessionError)
                  window.location.href = '/auth/login?error=session_failed'
                  return
                }

                // Sauvegarder la session dans Preferences pour persistance
                await saveSessionToPreferences()

                // Naviguer vers la page cible
                window.location.href = redirectTo
              }
            } catch (e) {
              console.error('[Capacitor] Erreur traitement deep link OAuth:', e)
            }
          }
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
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return <>{children}</>
}
