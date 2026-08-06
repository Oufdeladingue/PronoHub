'use client'

import { useLocale } from 'next-intl'
import { useState, useTransition, useId } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Sélecteur de langue (Brique C du chantier i18n).
 * Dropdown drapeau + code. Drapeaux en SVG inline (les emojis drapeaux ne sont
 * PAS rendus sous Windows). Au changement :
 *  - persiste profiles.locale (best-effort, non bloquant),
 *  - bascule la locale via next-intl (cookie NEXT_LOCALE + navigation préfixée).
 */

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const

/** Drapeaux SVG (fiables sur toutes les plateformes, contrairement aux emojis). */
function Flag({ code }: { code: string }) {
  const rid = useId()
  if (code === 'fr') {
    return (
      <svg viewBox="0 0 3 2" className="w-5 h-[14px] rounded-[2px] shrink-0 ring-1 ring-black/10" aria-hidden="true">
        <rect width="3" height="2" fill="#fff" />
        <rect width="1" height="2" fill="#0055A4" />
        <rect width="1" height="2" x="2" fill="#EF4135" />
      </svg>
    )
  }
  // EN → drapeau britannique (Union Jack) simplifié
  const clip = `uk-${rid}`
  return (
    <svg viewBox="0 0 60 30" className="w-5 h-[14px] rounded-[2px] shrink-0 ring-1 ring-black/10" aria-hidden="true">
      <clipPath id={clip}><rect width="60" height="30" /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
        <rect x="25" width="10" height="30" fill="#fff" />
        <rect y="10" width="60" height="10" fill="#fff" />
        <rect x="27" width="6" height="30" fill="#C8102E" />
        <rect y="12" width="60" height="6" fill="#C8102E" />
      </g>
    </svg>
  )
}

export default function LanguageSelector() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const current = LANGS.find((l) => l.code === locale) ?? LANGS[0]

  function choose(code: string) {
    setOpen(false)
    if (code === locale) return

    // Persister le choix côté profil (n'attend pas le résultat)
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('profiles').update({ locale: code }).eq('id', data.user.id).then(() => {})
        }
      })
    } catch {
      // best-effort
    }

    startTransition(() => {
      router.replace(pathname, { locale: code })
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Changer de langue / Change language"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-current/20 hover:border-current/40 opacity-90 hover:opacity-100 transition-all disabled:opacity-50"
      >
        <Flag code={current.code} />
        <span className="text-xs font-bold tracking-wide">{current.code.toUpperCase()}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`w-3 h-3 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          {/* Zone de fermeture au clic extérieur */}
          <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}
            className="absolute right-0 mt-1 z-50 min-w-[150px] rounded-lg border shadow-xl overflow-hidden py-1"
          >
            {LANGS.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l.code === locale}
                  onClick={() => choose(l.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-current/10 transition-colors ${l.code === locale ? 'font-bold text-[#ff9900]' : ''}`}
                >
                  <Flag code={l.code} />
                  <span>{l.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
