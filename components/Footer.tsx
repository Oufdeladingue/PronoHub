'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface FooterProps {
  variant?: 'full' | 'minimal'
}

export default function Footer({ variant = 'full' }: FooterProps) {
  const currentYear = new Date().getFullYear()
  const [isHidden, setIsHidden] = useState(false)
  const [lastScrollY, setLastScrollY] = useState(0)

  useEffect(() => {
    // Seulement sur desktop et pour la version full
    if (variant === 'minimal') return

    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scroll vers le bas et pas tout en haut -> cacher
        setIsHidden(true)
      } else {
        // Scroll vers le haut -> montrer
        setIsHidden(false)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY, variant])

  // Version minimale pour les pages d'accueil et auth
  if (variant === 'minimal') {
    return (
      <footer className="bg-black py-3">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-gray-500">
            <span>© {currentYear} PronoHub</span>
            <span className="hidden sm:inline">•</span>
            <div className="flex items-center gap-3">
              <Link href="/cgv" className="hover:text-[#ff9900] transition">
                CGU
              </Link>
              <Link href="/privacy" className="hover:text-[#ff9900] transition">
                Confidentialité
              </Link>
              <Link href="/about" className="hover:text-[#ff9900] transition">
                À propos
              </Link>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  // Version complète
  return (
    <>
      {/* Footer MOBILE - Non fixé, en bas de page */}
      {/* min-h-[72px] réserve l'espace pour éviter le CLS (layout shift) */}
      <footer className="md:hidden theme-nav border-t border-[var(--border-color)] mt-8 min-h-[72px]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col items-center gap-3">
            {/* Logo et copyright */}
            <div className="flex items-center gap-2">
              <img
                src="/images/logo.svg"
                alt="PronoHub"
                className="w-6 h-6"
              />
              <span className="text-gray-400 text-xs">
                © {currentYear} PronoHub
              </span>
            </div>

            {/* Liens */}
            <nav className="flex items-center gap-4 text-xs">
              <Link
                href="/about"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                À propos
              </Link>
              <Link
                href="/cgv"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                CGU
              </Link>
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                Confidentialité
              </Link>
              <Link
                href="/contact"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>

      {/* Footer DESKTOP - Ninja fixé en bas */}
      <footer
        className={`
          fixed bottom-0 left-0 w-full z-50
          theme-nav border-t border-[var(--border-color)]
          transition-transform duration-300 ease-in-out
          hidden md:block
          ${isHidden ? 'translate-y-full' : 'translate-y-0'}
        `}
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo et copyright */}
            <div className="flex items-center gap-2">
              <img
                src="/images/logo.svg"
                alt="PronoHub"
                className="w-6 h-6"
              />
              <span className="text-gray-400 text-xs">
                © {currentYear} PronoHub
              </span>
            </div>

            {/* Liens */}
            <nav className="flex items-center gap-4 text-xs">
              <Link
                href="/about"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                À propos
              </Link>
              <Link
                href="/cgv"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                CGU
              </Link>
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                Confidentialité
              </Link>
              <Link
                href="/contact"
                className="text-gray-400 hover:text-[#ff9900] transition"
              >
                Contact
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  )
}
