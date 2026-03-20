'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Trophy, Users, Target } from 'lucide-react'

interface WelcomeModalProps {
  onDismiss: (action: 'create' | 'join' | 'explore' | 'skip') => void
}

const slides = [
  {
    icon: Trophy,
    iconColor: 'text-[#ff9900]',
    iconBg: 'bg-[#ff9900]/10',
    title: 'Crée ton tournoi gratuitement',
    description: 'En quelques secondes, lance un tournoi de pronostics sur ta compétition préférée. C\'est gratuit, rapide, et tu peux inviter jusqu\'à 5 amis !',
    cta: 'Créer mon premier tournoi',
    action: 'create' as const,
  },
  {
    icon: Users,
    iconColor: 'text-[#4fc3f7]',
    iconBg: 'bg-[#4fc3f7]/10',
    title: 'Rejoins tes potes',
    description: 'Un ami a déjà créé un tournoi ? Rejoins-le avec son code d\'invitation et montre-leur qui est le vrai roi du prono !',
    cta: 'Rejoindre un tournoi',
    action: 'join' as const,
  },
  {
    icon: Target,
    iconColor: 'text-[#66bb6a]',
    iconBg: 'bg-[#66bb6a]/10',
    title: 'Pronostique et domine',
    description: 'Marque des points à chaque bon prono, cumule les bonus, grimpe au classement, débloque des badges et chambre tes potes dans le tchat !',
    cta: 'C\'est parti !',
    action: 'explore' as const,
  },
]

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const slide = slides[currentSlide]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-[420px] rounded-[14px] theme-secondary-bg border theme-border p-6 animate-in fade-in zoom-in-95 duration-300">
        {/* Logo app */}
        <div className="flex justify-center mb-5">
          <Image src="/images/logo.svg" alt="PronoHub" width={48} height={48} unoptimized />
        </div>

        {/* Slide content */}
        <div className="text-center mb-6 min-h-[180px] flex flex-col justify-center">
          <div className={`w-14 h-14 rounded-full ${slide.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <slide.icon className={`w-7 h-7 ${slide.iconColor}`} />
          </div>
          <h2 className="text-lg font-bold theme-text mb-2">
            {slide.title}
          </h2>
          <p className="text-sm theme-text-secondary leading-relaxed px-2">
            {slide.description}
          </p>
        </div>

        {/* CTA principal */}
        <button
          onClick={() => onDismiss(slide.action)}
          className="w-full px-6 py-3 rounded-lg bg-[#ff9900] text-black font-semibold text-sm hover:bg-[#e68a00] transition-colors mb-4"
        >
          {slide.cta}
        </button>

        {/* Navigation : dots + passer */}
        <div className="flex items-center justify-between">
          {/* Dots */}
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  index === currentSlide
                    ? 'bg-[#ff9900]'
                    : 'bg-gray-500/40 hover:bg-gray-500/60'
                }`}
              />
            ))}
          </div>

          {/* Passer / Suivant */}
          {currentSlide < slides.length - 1 ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onDismiss('skip')}
                className="text-xs theme-text-secondary hover:text-[#ff9900] transition-colors"
              >
                Passer
              </button>
              <button
                onClick={() => setCurrentSlide(currentSlide + 1)}
                className="text-xs font-semibold text-[#ff9900] hover:text-[#e68a00] transition-colors"
              >
                Suivant →
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDismiss('skip')}
              className="text-xs theme-text-secondary hover:text-[#ff9900] transition-colors"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
