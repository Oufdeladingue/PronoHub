'use client'

import Link from 'next/link'

interface FooterProps {
  variant?: 'full' | 'minimal'
}

export default function Footer({ variant = 'full' }: FooterProps) {
  const currentYear = new Date().getFullYear()

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

  // Version complète pour les autres pages
  return (
    <footer className="theme-nav border-t border-[var(--border-color)] mt-auto">
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
          <nav className="flex items-center gap-4 md:gap-4 gap-3 text-xs">
            <Link
              href="/about"
              className="text-gray-400 hover:text-[#ff9900] transition flex items-center"
              title="À propos"
            >
              <span className="hidden md:inline">À propos</span>
              <img
                src="/images/icons/propos.svg"
                alt="À propos"
                className="w-5 h-5 md:hidden theme-icon"
              />
            </Link>
            <Link
              href="/cgv"
              className="text-gray-400 hover:text-[#ff9900] transition flex items-center"
              title="CGU"
            >
              <span className="hidden md:inline">CGU</span>
              <img
                src="/images/icons/cgu.svg"
                alt="CGU"
                className="w-5 h-5 md:hidden theme-icon"
              />
            </Link>
            <Link
              href="/privacy"
              className="text-gray-400 hover:text-[#ff9900] transition flex items-center"
              title="Confidentialité"
            >
              <span className="hidden md:inline">Confidentialité</span>
              <img
                src="/images/icons/conf.svg"
                alt="Confidentialité"
                className="w-5 h-5 md:hidden theme-icon"
              />
            </Link>
            <Link
              href="/contact"
              className="text-gray-400 hover:text-[#ff9900] transition flex items-center"
              title="Contact"
            >
              <span className="hidden md:inline">Contact</span>
              <img
                src="/images/icons/contact.svg"
                alt="Contact"
                className="w-5 h-5 md:hidden theme-icon"
              />
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
