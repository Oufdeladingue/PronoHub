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
    <footer className="border-t border-[var(--border-color)] mt-auto" style={{ background: 'var(--nav-bg)' }}>
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
  )
}
