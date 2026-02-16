'use client'

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

const SECTIONS = [
  { id: 'hero', label: 'Accueil' },
  { id: 'how', label: 'Comment ça marche' },
  { id: 'features', label: 'Fonctionnalités' },
  { id: 'proof', label: 'Communauté' },
  { id: 'pricing', label: "C'est gratuit" },
  { id: 'cta', label: 'Commencer' },
] as const

const NAV_LINKS = SECTIONS.filter(s => ['how', 'features'].includes(s.id))

export function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = useState('hero')
  const [headerCompact, setHeaderCompact] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // ── Auth redirect (lazy-load Supabase pour réduire le bundle) ──
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getSession().then(({ data: { session } }) => {
        if (session) router.replace('/dashboard')
      })
    })
  }, [router])

  // ── Add js-loaded class for CSS animations ──────────
  useEffect(() => {
    document.documentElement.classList.add('js-loaded')
  }, [])

  // ── ScrollSpy (tracks which section is most visible) ──
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const sections = container.querySelectorAll<HTMLElement>('[data-chapter]')
    const ratios = new Map<string, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio)
        }
        // Pick the section with the highest visible ratio
        let best = ''
        let bestRatio = 0
        ratios.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            best = id
            bestRatio = ratio
          }
        })
        if (best && bestRatio > 0.05) {
          setActiveSection(best)
          history.replaceState(null, '', `#${best}`)
        }
      },
      { root: container, threshold: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1] }
    )

    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  // ── Animations (separate observer, respects reduced-motion) ──
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animElements = container.querySelectorAll<HTMLElement>('[data-animate]')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        }
      },
      { root: container, threshold: 0.1 }
    )

    animElements.forEach(el => observer.observe(el))
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

  // ── Hero parallax (desktop only, reduced-motion aware) ──
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (window.innerWidth < 768) return

    const bg = container.querySelector<HTMLImageElement>('.hero-parallax-bg')
    if (!bg) return

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const hero = container.querySelector('#hero')
        if (!hero) { ticking = false; return }
        const rect = hero.getBoundingClientRect()
        const offset = Math.max(-15, Math.min(15, rect.top * 0.05))
        bg.style.setProperty('--parallax', `${offset}px`)
        ticking = false
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  // ── Scroll to section ──────────────────────────────
  const scrollTo = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault()
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
          if (idx < SECTIONS.length - 1) {
            const el = scrollRef.current?.querySelector(`#${SECTIONS[idx + 1].id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          break
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault()
          if (idx > 0) {
            const el = scrollRef.current?.querySelector(`#${SECTIONS[idx - 1].id}`)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
          break
        case 'Home':
          e.preventDefault()
          scrollRef.current?.querySelector('#hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        case 'End':
          e.preventDefault()
          scrollRef.current?.querySelector('#cta')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          break
        case 'Escape':
          setMobileMenuOpen(false)
          break
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [activeSection])

  return (
    <div className="fixed inset-0 z-10 bg-[#020617]">
      {/* Noise texture overlay */}
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
            ? 'py-1.5 bg-[#020617]/85 backdrop-blur-md shadow-lg shadow-black/30'
            : 'py-3 bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <a
            href="#hero"
            onClick={(e) => scrollTo(e, 'hero')}
            className="flex items-center gap-2 shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Retour en haut"
          >
            <Image src="/images/logo.svg" alt="PronoHub" width={28} height={28} className="w-7 h-auto" unoptimized />
            <span className="hidden sm:inline text-white font-semibold text-sm">PronoHub</span>
          </a>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => scrollTo(e, s.id)}
                className={`text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff9900]/50 focus:ring-offset-0 rounded-sm ${
                  activeSection === s.id ? 'text-[#ff9900]' : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                {s.label}
              </a>
            ))}
          </nav>

          {/* CTAs + hamburger */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden sm:inline-block text-sm text-[#94a3b8] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#ff9900]/50 rounded-sm"
            >
              Se connecter
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm font-semibold rounded-[14px] px-5 py-2.5 bg-[#ff9900] text-[#1a1a1a] hover:bg-[#e68a00] transition-all duration-200 shadow-[0_0_12px_rgba(255,153,0,0.3)] active:scale-[0.98] active:shadow-none"
            >
              Créer mon tournoi
            </Link>
            <button
              className="md:hidden p-3 text-[#94a3b8]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
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

        {/* Mobile menu dropdown with transition */}
        <nav
          id="mobile-menu"
          aria-label="Menu mobile"
          aria-hidden={!mobileMenuOpen}
          className={`md:hidden bg-[#020617]/95 border-t border-white/[0.08] px-4 mobile-menu ${mobileMenuOpen ? 'mobile-menu-open py-3' : ''}`}
        >
          <div className="space-y-1.5">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => scrollTo(e, s.id)}
                className={`block w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                  activeSection === s.id
                    ? 'text-[#ff9900] bg-[#ff9900]/10'
                    : 'text-[#94a3b8] hover:text-white hover:bg-white/5'
                }`}
              >
                {s.label}
              </a>
            ))}
            <Link
              href="/auth/login"
              className="block w-full text-left px-4 py-3 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 sm:hidden"
            >
              Se connecter
            </Link>
          </div>
        </nav>

        {/* Backdrop overlay for mobile menu */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-[39] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
      </header>

      {/* ── Side Chapter Nav (desktop only) ──────── */}
      <nav
        className="hidden md:flex fixed right-5 top-1/2 -translate-y-1/2 z-40 flex-col gap-4"
        aria-label="Navigation des chapitres"
      >
        {SECTIONS.map(s => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => scrollTo(e, s.id)}
            className="group relative flex items-center justify-end p-2 focus:outline-none focus:ring-2 focus:ring-[#ff9900]/50 rounded-sm"
            aria-label={s.label}
            aria-current={activeSection === s.id ? 'true' : undefined}
          >
            {/* Tooltip */}
            <span className="absolute right-9 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-xs text-white bg-[#1e293b]/90 px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none border border-white/[0.08]">
              {s.label}
            </span>
            {/* Hexagon */}
            <svg width="16" height="18" viewBox="0 0 16 18" className={`transition-all duration-300 ${
              activeSection === s.id
                ? 'drop-shadow-[0_0_6px_rgba(255,153,0,0.5)]'
                : ''
            }`}>
              <polygon
                points="8,1 15,5 15,13 8,17 1,13 1,5"
                className={`transition-all duration-300 ${
                  activeSection === s.id
                    ? 'fill-[#ff9900] stroke-[#ff9900]'
                    : 'fill-transparent stroke-[#94a3b8]/40 group-hover:stroke-white/60'
                }`}
                strokeWidth="1.2"
              />
            </svg>
          </a>
        ))}
      </nav>

      {/* ── Scroll Container (main for semantics + SEO) ── */}
      <div
        ref={scrollRef}
        role="main"
        id="main-content"
        className="h-full overflow-y-auto scroll-smooth overscroll-contain md:snap-y md:snap-proximity"
        style={{ scrollPaddingTop: '64px' }}
      >
        {children}
      </div>
    </div>
  )
}
