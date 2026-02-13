'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

const SECTIONS = [
  { id: 'hero', label: 'Accueil' },
  { id: 'how', label: 'Comment ça marche' },
  { id: 'features', label: 'Fonctionnalités' },
  { id: 'proof', label: 'Communauté' },
  { id: 'pricing', label: 'Tarifs' },
  { id: 'cta', label: 'Commencer' },
] as const

const NAV_LINKS = SECTIONS.filter(s => ['how', 'features', 'pricing'].includes(s.id))

export function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState('hero')
  const [headerCompact, setHeaderCompact] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ── Auth redirect ──────────────────────────────────
  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
    })
  }, [router])

  // ── ScrollSpy (IntersectionObserver) ───────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const sections = container.querySelectorAll<HTMLElement>('[data-chapter]')
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const id = entry.target.id
            setActiveSection(id)
            history.replaceState(null, '', `#${id}`)
          }
        }
      },
      { root: container, threshold: 0.55 }
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // ── Header compact on scroll ───────────────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const handler = () => {
      setHeaderCompact(container.scrollTop > 60)
    }
    container.addEventListener('scroll', handler, { passive: true })
    return () => container.removeEventListener('scroll', handler)
  }, [])

  // ── Section entrance animations ────────────────────
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const container = scrollRef.current
    if (!container) return
    const elements = container.querySelectorAll<HTMLElement>('[data-animate]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { root: container, threshold: 0.1 }
    )
    elements.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  // ── Scroll to section ──────────────────────────────
  const scrollTo = useCallback((id: string) => {
    const el = scrollRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileMenuOpen(false)
  }, [])

  // ── Keyboard navigation ────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = SECTIONS.findIndex(s => s.id === activeSection)
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault()
          if (idx < SECTIONS.length - 1) scrollTo(SECTIONS[idx + 1].id)
          break
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          if (idx > 0) scrollTo(SECTIONS[idx - 1].id)
          break
        case 'Home':
          e.preventDefault()
          scrollTo('hero')
          break
        case 'End':
          e.preventDefault()
          scrollTo('cta')
          break
        case 'Escape':
          setMobileMenuOpen(false)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSection, scrollTo])

  return (
    <div className="fixed inset-0 z-10 bg-[#020617]">
      {/* Noise overlay (SVG feTurbulence) */}
      <svg className="fixed inset-0 z-[1] w-full h-full pointer-events-none opacity-[0.02]" aria-hidden="true">
        <filter id="landing-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#landing-noise)" />
      </svg>

      {/* Spotlight */}
      <div className="landing-spotlight" aria-hidden="true" />

      {/* ── Sticky Header ────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          headerCompact
            ? 'py-2 bg-[#020617]/90 backdrop-blur-xl shadow-lg shadow-black/30'
            : 'py-3 bg-[#020617]/60 backdrop-blur-md'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => scrollTo('hero')}
            className="flex items-center gap-2 shrink-0"
            aria-label="Retour en haut"
          >
            <Image src="/images/logo.svg" alt="PronoHub" width={28} height={28} className="w-7 h-auto" />
          </button>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`text-sm font-medium transition-colors duration-200 ${
                  activeSection === s.id ? 'text-[#ff9900]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* CTAs + hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden sm:inline-block text-sm text-[#94a3b8] hover:text-white transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-semibold rounded-[14px] px-5 py-2 bg-[#ff9900] text-[#1a1a1a] hover:bg-[#e68a00] transition-colors shadow-[0_0_12px_rgba(255,153,0,0.3)]"
            >
              Créer mon tournoi
            </Link>
            <button
              className="md:hidden p-2 text-[#94a3b8]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#020617]/95 backdrop-blur-xl border-t border-white/[0.08] px-4 py-3 space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeSection === s.id
                    ? 'text-[#ff9900] bg-[#ff9900]/10'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                {s.label}
              </button>
            ))}
            <Link
              href="/auth/login"
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 sm:hidden"
            >
              Se connecter
            </Link>
          </div>
        )}
      </header>

      {/* ── Side Chapter Nav (desktop only) ──────── */}
      <nav
        className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-40 flex-col gap-4"
        aria-label="Navigation des chapitres"
      >
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="group relative flex items-center justify-end"
            aria-label={s.label}
            aria-current={activeSection === s.id ? 'true' : undefined}
          >
            {/* Tooltip */}
            <span className="absolute right-7 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-white bg-[#1e293b]/90 backdrop-blur-sm px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none border border-white/[0.08]">
              {s.label}
            </span>
            {/* Dot */}
            <span
              className={`block rounded-full transition-all duration-300 ${
                activeSection === s.id
                  ? 'w-3 h-3 bg-[#ff9900] shadow-[0_0_10px_rgba(255,153,0,0.6)]'
                  : 'w-2 h-2 bg-[#64748b] hover:bg-[#94a3b8]'
              }`}
            />
          </button>
        ))}
      </nav>

      {/* ── Scroll Container ─────────────────────── */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto scroll-smooth overscroll-contain md:snap-y md:snap-mandatory"
        style={{ scrollPaddingTop: '64px' }}
      >
        {children}
      </div>
    </div>
  )
}
