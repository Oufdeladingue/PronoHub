'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

// Phrases de chargement (les mêmes que login pour cohérence)
const loadingMessages = [
  'On chauffe les crampons…',
  'Le ballon est encore chez l\'arbitre, on va le récupérer…',
  'On vérifie si la VAR valide le chargement…',
  'Le serveur s\'est pris un petit pont, il revient…',
  'On fait un changement… chargement incoming.',
  'On cherche la connexion… elle s\'est cachée derrière la défense.',
  'On temporise… comme Giroud dos au jeu.',
  'Réchauffage : nos serveurs tirent des coups francs.',
  'On prépare une occasion… faut juste cadrer le chargement.',
]

export default function DashboardLoading() {
  // Commencer à 85% pour donner l'impression de continuité avec le loader login
  const [loadingPercent, setLoadingPercent] = useState(85)
  const [loadingMessage] = useState(() =>
    loadingMessages[Math.floor(Math.random() * loadingMessages.length)]
  )

  // Animation qui continue vers 100%
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingPercent(prev => {
        if (prev >= 99) return 99 // Rester à 99% jusqu'à ce que le SSR finisse
        return prev + 0.3
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-50">
      <div className="flex flex-col items-center gap-6">
        {/* Logo avec effet de remplissage */}
        <div className="relative w-24 h-24">
          <Image
            src="/images/logo.svg"
            alt="PronoHub"
            width={96}
            height={96}
            className="w-24 h-24 opacity-20 grayscale"
            priority
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(${100 - loadingPercent}% 0 0 0)` }}
          >
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={96}
              height={96}
              className="w-24 h-24"
              priority
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[#ff9900] text-2xl font-bold">{Math.round(loadingPercent)}%</span>
          <span className="text-gray-400 text-sm text-center px-8">{loadingMessage}</span>
        </div>
      </div>
    </div>
  )
}
