'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface ScrollToTopButtonProps {
  /**
   * Seuil de scroll (en pixels) à partir duquel le bouton apparaît
   * @default 800
   */
  threshold?: number
  /**
   * Position du bouton
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left'
  /**
   * Marge depuis le bord (en pixels)
   * @default { bottom: 24, horizontal: 24 }
   */
  margin?: { bottom: number; horizontal: number }
}

export default function ScrollToTopButton({
  threshold = 800,
  position = 'bottom-right',
  margin = { bottom: 24, horizontal: 24 }
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const { theme } = useTheme()

  // Détecte le mouvement de scroll pour afficher/masquer le bouton
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop

      // Afficher le bouton si on a scrollé au-delà du seuil
      setIsVisible(scrollTop > threshold)

      // Masquer temporairement pendant le scroll actif (optionnel)
      setIsScrolling(true)
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false)
      }, 150)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    // Vérifier la position initiale
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [threshold])

  // Gère le clic : scroll vers le haut avec animation
  const scrollToTop = () => {
    // Vérifier si l'utilisateur préfère réduire les animations
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Scroll instantané si prefers-reduced-motion
      window.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      // Scroll animé smooth
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Remettre le focus sur le body après remontée (accessibilité)
    setTimeout(() => {
      document.body.focus()
    }, 300)
  }

  // Ne pas afficher le bouton si pas visible
  if (!isVisible) {
    return null
  }

  // Couleurs adaptées au thème
  const isDark = theme === 'dark'

  return (
    <button
      onClick={scrollToTop}
      aria-label="Remonter en haut de la page"
      style={{
        bottom: `${margin.bottom}px`,
        [position === 'bottom-right' ? 'right' : 'left']: `${margin.horizontal}px`
      }}
      className={`
        fixed z-50
        w-12 h-12
        rounded-full
        ${isDark ? 'bg-gray-800 text-orange-400 hover:bg-gray-700 border-gray-700' : 'bg-white text-orange-600 hover:bg-gray-50 border-gray-200'}
        border-2
        ${isDark ? 'shadow-gray-900/50' : 'shadow-gray-900/10'}
        shadow-lg
        transition-all duration-300
        ${isScrolling ? 'opacity-50 scale-90' : 'opacity-100 scale-100'}
        hover:scale-110
        active:scale-95
        focus:outline-none
        focus:ring-2
        focus:ring-orange-500
        focus:ring-offset-2
        ${isDark ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
        flex items-center justify-center
        touch-manipulation
      `}
      // Taille de cible tactile minimum 44x44px (respectée ici avec w-12 h-12 = 48px)
    >
      {/* Icône flèche vers le haut */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>

      {/* Label visible uniquement pour les lecteurs d'écran */}
      <span className="sr-only">Remonter en haut de la page</span>
    </button>
  )
}
