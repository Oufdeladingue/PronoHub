'use client'

import { Trophy, Users, TrendingUp } from 'lucide-react'

interface WelcomeModalProps {
  onDismiss: (action: 'create' | 'explore') => void
}

const steps = [
  {
    icon: Trophy,
    title: 'Choisis une compétition',
    description: 'Ligue 1, Premier League, Champions League… à toi de jouer.',
  },
  {
    icon: Users,
    title: 'Crée un tournoi et invite tes amis',
    description: 'Défie tes potes sur les matchs à venir.',
  },
  {
    icon: TrendingUp,
    title: 'Pronostique et grimpe au classement',
    description: 'Marque des points à chaque bon prono !',
  },
]

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-[420px] rounded-[14px] theme-secondary-bg border theme-border p-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⚽</div>
          <h2 className="text-xl font-bold theme-text">
            Bienvenue sur PronoHub !
          </h2>
          <p className="text-sm theme-text-secondary mt-1">
            Le jeu de pronostics entre amis
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#ff9900]/10 flex items-center justify-center">
                <step.icon className="w-5 h-5 text-[#ff9900]" />
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">{step.title}</p>
                <p className="text-xs theme-text-secondary">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={() => onDismiss('create')}
            className="w-full px-6 py-3 rounded-lg bg-[#ff9900] text-black font-semibold text-sm hover:bg-[#e68a00] transition-colors"
          >
            Créer mon premier tournoi
          </button>
          <button
            onClick={() => onDismiss('explore')}
            className="w-full px-6 py-3 rounded-lg border theme-border theme-text font-medium text-sm hover:border-[#ff9900] hover:text-[#ff9900] transition-colors"
          >
            Explorer les compétitions
          </button>
        </div>
      </div>
    </div>
  )
}
