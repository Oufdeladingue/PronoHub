'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'

interface ReferralStatsModalProps {
  active: boolean          // tournoi public + user participant
  tournamentId: string
  tournamentCode: string   // invite_code ou slug (pour le lien /tournoi-public/…)
  tournamentName: string
  userId: string
}

/**
 * Modale d'incitation au parrainage pour les tournois PUBLICS (qui n'ont pas de phase
 * d'échauffement). S'affiche une fois par appareil/tournoi à la connexion, tant que
 * l'utilisateur n'a pas déjà les stats et n'a pas atteint le seuil de filleuls.
 * Invite {threshold} amis via son lien perso → débloque les Stats avancées sur ce tournoi.
 */
export default function ReferralStatsModal({ active, tournamentId, tournamentCode, tournamentName, userId }: ReferralStatsModalProps) {
  const t = useTranslations('Referral')
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [threshold, setThreshold] = useState(2)
  const [copied, setCopied] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!active || !userId) return
    const seenKey = `refStatsModalSeen:${tournamentId}`
    let cancelled = false
    ;(async () => {
      try {
        const [refRes, accessRes] = await Promise.all([
          fetch(`/api/tournaments/${tournamentId}/referrals`).then((r) => r.json()).catch(() => null),
          fetch(`/api/stats/access?tournamentId=${tournamentId}`).then((r) => r.json()).catch(() => null),
        ])
        if (cancelled) return
        const c = refRes?.count ?? 0
        const th = refRes?.threshold ?? 2
        setCount(c)
        setThreshold(th)
        // Ne pas afficher si déjà accès stats, seuil déjà atteint, ou déjà vu sur cet appareil.
        if (accessRes?.hasAccess) return
        if (c >= th) return
        if (typeof localStorage !== 'undefined' && localStorage.getItem(seenKey)) return
        setOpen(true)
        try { localStorage.setItem(seenKey, '1') } catch {}
      } catch {}
    })()
    return () => { cancelled = true }
  }, [active, userId, tournamentId])

  if (!mounted || !open) return null

  const inviteUrl = `${window.location.origin}/tournoi-public/${tournamentCode}?ref=${userId}`
  const copy = () => {
    navigator.clipboard?.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${t('shareText', { name: tournamentName })}\n${inviteUrl}`)}`

  return createPortal(
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="theme-card max-w-md w-full !p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 text-center" style={{ background: 'linear-gradient(135deg, #ff9900 0%, #ff6600 100%)' }}>
          <div className="text-4xl mb-1">🔓📊</div>
          <h2 className="text-lg font-bold text-black">{t('title')}</h2>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm theme-text-secondary text-center leading-relaxed">
            {t('intro', { n: threshold })}
          </p>

          {/* Progression */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold theme-text-secondary">{t('progress', { count, threshold })}</span>
              <span className="text-xs font-bold text-[#ff9900]">{count}/{threshold}</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full bg-[#ff9900] transition-all" style={{ width: `${Math.min(100, (count / threshold) * 100)}%` }} />
            </div>
          </div>

          {/* Lien perso */}
          <div>
            <p className="text-xs theme-text-secondary mb-1.5">{t('linkLabel')}</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 theme-input text-xs !py-2 truncate"
              />
              <button
                onClick={copy}
                className="px-3 py-2 rounded-lg bg-[#ff9900] text-black text-xs font-bold whitespace-nowrap hover:brightness-110 transition"
              >
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white transition hover:opacity-90"
              style={{ background: '#25D366' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              {t('shareWhatsApp')}
            </a>
            <button
              onClick={() => setOpen(false)}
              className="w-full px-4 py-2.5 theme-bg theme-text rounded-lg border theme-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              {t('later')}
            </button>
          </div>
          <p className="text-[11px] theme-text-secondary text-center">{t('footnote')}</p>
        </div>
      </div>
    </div>,
    document.body
  )
}
