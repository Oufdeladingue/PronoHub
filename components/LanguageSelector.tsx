'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Sélecteur de langue (Brique C du chantier i18n).
 * Deux langues pour l'instant (FR/EN) → bouton bascule, style aligné sur ThemeToggle.
 * Au changement :
 *  - persiste le choix dans profiles.locale (best-effort, non bloquant),
 *  - bascule la locale via next-intl (pose le cookie NEXT_LOCALE + navigue vers
 *    la version préfixée), pour que le choix survive à la navigation et aux visites.
 */
export default function LanguageSelector() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const next = locale === 'fr' ? 'en' : 'fr'

  function switchLanguage() {
    // Persister le choix côté profil (n'attend pas le résultat)
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('profiles').update({ locale: next }).eq('id', data.user.id).then(() => {})
        }
      })
    } catch {
      // best-effort : on bascule quand même l'UI
    }

    startTransition(() => {
      router.replace(pathname, { locale: next })
    })
  }

  return (
    <button
      onClick={switchLanguage}
      disabled={pending}
      title="Changer de langue / Change language"
      aria-label={`Langue actuelle : ${locale.toUpperCase()}. Basculer en ${next.toUpperCase()}.`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-current/20 hover:border-current/40 opacity-80 hover:opacity-100 transition-all disabled:opacity-50"
    >
      {/* Icône globe (currentColor → theme-safe) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <span className="text-xs font-bold tracking-wide tabular-nums">{locale.toUpperCase()}</span>
    </button>
  )
}
