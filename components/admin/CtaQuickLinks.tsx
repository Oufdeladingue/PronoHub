'use client'

const BASE = 'https://www.pronohub.club'

const QUICK_LINKS = [
  { label: 'Dashboard', icon: '🏠', url: `${BASE}/dashboard` },
  { label: 'Créer un tournoi', icon: '🏆', url: `${BASE}/vestiaire` },
  { label: 'Tarifs', icon: '💰', url: `${BASE}/pricing` },
  { label: 'Profil', icon: '👤', url: `${BASE}/profile` },
  { label: 'Contact', icon: '📩', url: `${BASE}/contact` },
  { label: 'Rejoindre', icon: '🤝', url: `${BASE}/vestiaire/rejoindre` },
]

interface CtaQuickLinksProps {
  onSelect: (url: string) => void
  disabled?: boolean
}

export default function CtaQuickLinks({ onSelect, disabled }: CtaQuickLinksProps) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {QUICK_LINKS.map(link => (
        <button
          key={link.url}
          type="button"
          onClick={() => onSelect(link.url)}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-orange-50 hover:text-orange-700 text-gray-600 rounded-md border border-gray-200 hover:border-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={link.url}
        >
          <span>{link.icon}</span>
          <span>{link.label}</span>
        </button>
      ))}
    </div>
  )
}
