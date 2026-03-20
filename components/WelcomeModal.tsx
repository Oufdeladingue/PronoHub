'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface WelcomeModalProps {
  onDismiss: (action: 'create' | 'join' | 'explore' | 'skip') => void
}

const slides = [
  {
    image: '/images/welcome-create.png',
    title: 'Crée ton tournoi gratuitement',
    description: 'En quelques secondes, lance un tournoi de pronostics sur ta compétition préférée. C\'est gratuit, rapide, et tu peux inviter jusqu\'à 5 amis !',
    cta: 'Créer mon premier tournoi',
    action: 'create' as const,
  },
  {
    image: '/images/welcome-join.png',
    title: 'Rejoins tes potes',
    description: 'Un ami a déjà créé un tournoi ? Rejoins-le avec son code d\'invitation et montre-leur qui est le vrai roi du prono !',
    cta: 'Rejoindre un tournoi',
    action: 'join' as const,
  },
  {
    image: '/images/welcome-predict.png',
    title: 'Pronostique et domine',
    description: 'Marque des points à chaque bon prono, cumule les bonus, grimpe au classement, débloque des badges et chambre tes potes dans le tchat !',
    cta: 'C\'est parti !',
    action: 'explore' as const,
  },
]

const AUTO_ADVANCE_MS = 5000

export default function WelcomeModal({ onDismiss }: WelcomeModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const slide = slides[currentSlide]

  const goToNext = useCallback(() => {
    setCurrentSlide(prev => (prev + 1) % slides.length)
  }, [])

  // Auto-advance
  useEffect(() => {
    if (paused) return
    const timer = setInterval(goToNext, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, goToNext])

  // Pause on user interaction, resume after a delay
  const handleDotClick = (index: number) => {
    setCurrentSlide(index)
    setPaused(true)
    setTimeout(() => setPaused(false), AUTO_ADVANCE_MS * 2)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
      <div className="w-full max-w-[420px] rounded-[14px] theme-secondary-bg border theme-border overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Logo app */}
        <div className="flex justify-center pt-5 pb-2">
          <Image src="/images/logo.svg" alt="PronoHub" width={40} height={40} unoptimized />
        </div>

        {/* Illustration */}
        <div className="relative w-full aspect-[3/2] max-w-[320px] mx-auto px-4">
          <Image
            src={slide.image}
            alt={slide.title}
            fill
            className="object-contain transition-opacity duration-300"
            unoptimized
          />
        </div>

        {/* Texte */}
        <div className="text-center px-6 pb-2 min-h-[110px] flex flex-col justify-center">
          <h2 className="text-lg font-bold theme-text mb-2">
            {slide.title}
          </h2>
          <p className="text-sm theme-text-secondary leading-relaxed">
            {slide.description}
          </p>
        </div>

        {/* CTA */}
        <div className="px-6">
          <button
            onClick={() => onDismiss(slide.action)}
            className="w-full px-6 py-3 rounded-lg bg-[#ff9900] text-black font-semibold text-sm hover:bg-[#e68a00] transition-colors"
          >
            {slide.cta}
          </button>
        </div>

        {/* Dots centrés + Passer à droite */}
        <div className="flex items-center justify-center relative px-6 py-4">
          <div className="flex gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => handleDotClick(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'bg-[#ff9900] scale-110'
                    : 'bg-gray-500/40 hover:bg-gray-500/60'
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => onDismiss('skip')}
            className="absolute right-6 text-xs theme-text-secondary hover:text-[#ff9900] transition-colors"
          >
            Passer
          </button>
        </div>
      </div>
    </div>
  )
}
