'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationLoader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Quand la route change, on cache le loader
    setIsLoading(false)
    setIsVisible(false)
  }, [pathname, searchParams])

  useEffect(() => {
    // Écouter les clics sur les liens de navigation
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (link) {
        const href = link.getAttribute('href')
        // Si c'est un lien interne et pas vers la page actuelle
        if (href && href.startsWith('/') && href !== pathname && !href.startsWith('#')) {
          setIsLoading(true)
          // Petit délai avant d'afficher pour éviter les flashs sur les navigations rapides
          setTimeout(() => {
            setIsVisible(true)
          }, 100)
        }
      }
    }

    // Écouter les soumissions de formulaires (comme le logout)
    const handleSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement
      const action = form.getAttribute('action')
      if (action && action.startsWith('/')) {
        setIsLoading(true)
        setTimeout(() => {
          setIsVisible(true)
        }, 100)
      }
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('submit', handleSubmit)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('submit', handleSubmit)
    }
  }, [pathname])

  if (!isLoading) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        {/* Logo animé */}
        <div className="relative">
          <img
            src="/images/logo.svg"
            alt="PronoHub"
            className="w-20 h-20 animate-pulse drop-shadow-[0_0_30px_rgba(255,153,0,0.6)]"
          />
          {/* Cercle de chargement autour du logo */}
          <div className="absolute inset-0 -m-2">
            <svg className="w-24 h-24 animate-spin-slow" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgba(255, 153, 0, 0.2)"
                strokeWidth="3"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#ff9900"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="70 200"
                className="origin-center"
              />
            </svg>
          </div>
        </div>
        {/* Texte de chargement */}
        <p className="text-[#ff9900] font-semibold text-sm animate-pulse">
          Chargement...
        </p>
      </div>
    </div>
  )
}
