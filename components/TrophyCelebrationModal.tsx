'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'

interface TrophyCelebrationModalProps {
  trophy: {
    name: string
    description: string
    imagePath: string
    unlocked_at: string
    triggerMatch?: {
      homeTeamName: string
      awayTeamName: string
      homeTeamCrest: string | null
      awayTeamCrest: string | null
      competitionId: number
    }
  }
  onClose: () => void
}

export default function TrophyCelebrationModal({ trophy, onClose }: TrophyCelebrationModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const cardRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  // Détecter le thème actif
  useEffect(() => {
    const currentTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark'
    setTheme(currentTheme)
  }, [])

  // Animation d'entrée après 100ms (très rapide)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Formater la date de déblocage
  const unlockedDate = new Date(trophy.unlocked_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  // Couleurs selon le thème
  const themeColor = theme === 'dark' ? '#F59E0B' : '#3B82F6' // amber-500 : blue-500
  const bgColor = '#000000'
  const borderColor = themeColor

  // Fonction pour télécharger l'image
  const downloadImage = async () => {
    if (!cardRef.current || isDownloading) return

    setIsDownloading(true)
    console.log('[Download] Début du téléchargement')

    try {
      // APPROCHE FROM SCRATCH: Créer un nouveau div avec ZÉRO Tailwind, que du inline
      const captureDiv = document.createElement('div')
      captureDiv.style.cssText = `
        width: 384px;
        background: #000000;
        border-radius: 16px;
        border: 3px solid ${themeColor};
        padding: 20px;
        padding-top: 56px;
        position: fixed;
        left: -9999px;
        top: 0;
      `

      // Logo
      const logo = document.createElement('img')
      logo.src = '/images/logo.png'
      logo.style.cssText = 'position: absolute; top: 12px; left: 12px; width: 40px; height: 40px;'
      captureDiv.appendChild(logo)

      // Titre
      const title = document.createElement('h2')
      title.textContent = 'Bravo, un trophée de plus sur l\'étagère !'
      title.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        text-align: center;
        margin-bottom: 16px;
        color: ${themeColor};
      `
      captureDiv.appendChild(title)

      // Image trophée
      const trophyImg = document.createElement('img')
      trophyImg.src = trophy.imagePath
      trophyImg.style.cssText = 'display: block; margin: 0 auto 16px; width: 140px; height: 140px;'
      captureDiv.appendChild(trophyImg)

      // Nom du trophée
      const trophyName = document.createElement('h3')
      trophyName.textContent = trophy.name
      trophyName.style.cssText = 'font-size: 24px; font-weight: bold; color: white; text-align: center; margin-bottom: 8px;'
      captureDiv.appendChild(trophyName)

      // Description
      const desc = document.createElement('p')
      desc.textContent = trophy.description
      desc.style.cssText = 'font-size: 16px; color: #D1D5DB; text-align: center; margin-bottom: 8px; font-style: italic;'
      captureDiv.appendChild(desc)

      // Date
      const unlockedDate = new Date(trophy.unlocked_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
      const date = document.createElement('p')
      date.textContent = `Débloqué le ${unlockedDate}`
      date.style.cssText = 'font-size: 12px; color: #9CA3AF; text-align: center; margin-bottom: 16px;'
      captureDiv.appendChild(date)

      // Match déclencheur
      if (trophy.triggerMatch) {
        const matchDiv = document.createElement('div')
        matchDiv.style.cssText = 'background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 16px;'

        const matchLabel = document.createElement('p')
        matchLabel.textContent = 'Match déclencheur'
        matchLabel.style.cssText = 'font-size: 12px; color: #9CA3AF; text-align: center; margin-bottom: 8px;'
        matchDiv.appendChild(matchLabel)

        const matchContent = document.createElement('div')
        matchContent.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 12px;'

        // Home team
        const homeDiv = document.createElement('div')
        homeDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex: 1;'
        if (trophy.triggerMatch.homeTeamCrest) {
          const homeImg = document.createElement('img')
          homeImg.src = trophy.triggerMatch.homeTeamCrest
          homeImg.style.cssText = 'width: 36px; height: 36px; margin-bottom: 4px;'
          homeDiv.appendChild(homeImg)
        }
        const homeName = document.createElement('p')
        homeName.textContent = trophy.triggerMatch.homeTeamName
        homeName.style.cssText = 'font-size: 12px; font-weight: 500; color: white; text-align: center;'
        homeDiv.appendChild(homeName)
        matchContent.appendChild(homeDiv)

        // VS
        const vs = document.createElement('span')
        vs.textContent = 'vs'
        vs.style.cssText = 'font-size: 18px; font-weight: bold; color: #6B7280;'
        matchContent.appendChild(vs)

        // Away team
        const awayDiv = document.createElement('div')
        awayDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex: 1;'
        if (trophy.triggerMatch.awayTeamCrest) {
          const awayImg = document.createElement('img')
          awayImg.src = trophy.triggerMatch.awayTeamCrest
          awayImg.style.cssText = 'width: 36px; height: 36px; margin-bottom: 4px;'
          awayDiv.appendChild(awayImg)
        }
        const awayName = document.createElement('p')
        awayName.textContent = trophy.triggerMatch.awayTeamName
        awayName.style.cssText = 'font-size: 12px; font-weight: 500; color: white; text-align: center;'
        awayDiv.appendChild(awayName)
        matchContent.appendChild(awayDiv)

        matchDiv.appendChild(matchContent)
        captureDiv.appendChild(matchDiv)
      }

      // Footer
      const footer = document.createElement('div')
      footer.style.cssText = 'border-top: 1px solid #1F2937; padding-top: 12px;'
      const footerText = document.createElement('p')
      footerText.textContent = 'pronohub.club'
      footerText.style.cssText = 'font-size: 12px; color: #9CA3AF; font-weight: 500; text-align: center;'
      footer.appendChild(footerText)
      captureDiv.appendChild(footer)

      document.body.appendChild(captureDiv)
      console.log('[Download] Div from scratch créé et ajouté au DOM')

      await new Promise(resolve => setTimeout(resolve, 200))
      console.log('[Download] Début capture')

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureDiv, {
        backgroundColor: '#000000',
        scale: 2,
        useCORS: true,
        allowTaint: true
      })

      console.log('[Download] Capture réussie')
      document.body.removeChild(captureDiv)

      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `pronohub-trophy-${trophy.name.replace(/\s+/g, '-').toLowerCase()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
          console.log('[Download] Téléchargement déclenché')
        }
        setIsDownloading(false)
      })
    } catch (error) {
      console.error('[Download] Error downloading image:', error)
      console.error('[Download] Error stack:', (error as Error).stack)
      alert('Erreur lors du téléchargement de l\'image')
      setIsDownloading(false)
    }
  }

  // Fonction pour partager sur Facebook
  const shareOnFacebook = () => {
    const url = `https://www.pronohub.club/trophies/${encodeURIComponent(trophy.name)}`
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    window.open(shareUrl, '_blank', 'width=600,height=400')
  }

  // Fonction pour partager sur WhatsApp
  const shareOnWhatsApp = () => {
    const text = `🎉 J'ai débloqué le trophée "${trophy.name}" sur PronoHub ! ${trophy.description}\nRejoins-moi sur pronohub.club`
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(shareUrl, '_blank')
  }

  // Fonction pour partager avec le Web Share API (autres options)
  const shareOther = async () => {
    const text = `🎉 J'ai débloqué le trophée "${trophy.name}" sur PronoHub !\n${trophy.description}\n\nRejoins-moi sur pronohub.club`

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trophée PronoHub - ${trophy.name}`,
          text: text,
          url: 'https://www.pronohub.club'
        })
      } catch (error) {
        console.log('Partage annulé')
      }
    } else {
      navigator.clipboard.writeText(text)
      alert('Texte copié dans le presse-papier !')
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.6)' : 'transparent'
      }}
      onClick={onClose}
    >
      {/* Carte de célébration */}
      <div
        ref={cardRef}
        className={`relative w-full max-w-sm bg-black rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        style={{
          border: `3px solid ${borderColor}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo PronoHub en haut à gauche */}
        <div className="absolute top-3 left-3 z-20">
          <img
            src="/images/logo.png"
            alt="PronoHub"
            width={40}
            height={40}
            className="drop-shadow-lg"
          />
        </div>

        {/* Bouton fermer en haut à droite */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-10 transition"
          style={{ color: themeColor }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Étoiles animées en arrière-plan qui tombent */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden stars-container">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall-star"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-20px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={themeColor} opacity="0.7">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          ))}
        </div>

        {/* Contenu */}
        <div className="relative p-5 pt-14">
          {/* Titre */}
          <h2
            className="text-xl font-bold text-center mb-4"
            style={{ color: themeColor }}
          >
            Bravo, un trophée de plus sur l'étagère !
          </h2>

          {/* Image du trophée */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full blur-2xl opacity-40 animate-pulse"
                style={{ backgroundColor: themeColor }}
              ></div>
              <img
                src={trophy.imagePath}
                alt={trophy.name}
                width={140}
                height={140}
                className="relative z-10 drop-shadow-2xl"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/trophy/default.png'
                }}
              />
            </div>
          </div>

          {/* Nom du trophée */}
          <h3 className="text-2xl font-bold text-white text-center mb-2">
            {trophy.name}
          </h3>

          {/* Description du trophée */}
          <p className="text-base text-gray-300 text-center mb-2 italic">
            {trophy.description}
          </p>

          {/* Match déclencheur */}
          {trophy.triggerMatch && (
            <div
              className="rounded-lg p-3 mb-4 shadow-inner"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <p className="text-xs text-gray-400 mb-2 text-center">
                Débloqué le {unlockedDate} grâce à :
              </p>
              <div className="flex items-center justify-center gap-3">
                {/* Équipe domicile */}
                <div className="flex flex-col items-center flex-1">
                  {trophy.triggerMatch.homeTeamCrest ? (
                    <img
                      src={trophy.triggerMatch.homeTeamCrest}
                      alt={trophy.triggerMatch.homeTeamName}
                      width={36}
                      height={36}
                      className="mb-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-lg">⚽</span>
                    </div>
                  )}
                  <p className="text-xs font-medium text-white text-center line-clamp-2">
                    {trophy.triggerMatch.homeTeamName}
                  </p>
                </div>

                {/* VS */}
                <span className="text-lg font-bold text-gray-500">vs</span>

                {/* Équipe extérieur */}
                <div className="flex flex-col items-center flex-1">
                  {trophy.triggerMatch.awayTeamCrest ? (
                    <img
                      src={trophy.triggerMatch.awayTeamCrest}
                      alt={trophy.triggerMatch.awayTeamName}
                      width={36}
                      height={36}
                      className="mb-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 mb-1 rounded-full bg-gray-700 flex items-center justify-center">
                      <span className="text-lg">⚽</span>
                    </div>
                  )}
                  <p className="text-xs font-medium text-white text-center line-clamp-2">
                    {trophy.triggerMatch.awayTeamName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Boutons de partage */}
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium text-gray-300 text-center">
              Chambrage sur les réseaux
            </p>

            <div className="flex gap-2 justify-center items-center">
              {/* Facebook */}
              <button
                onClick={shareOnFacebook}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-10 transition"
                title="Facebook"
              >
                <svg className="w-6 h-6" fill={themeColor} viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>

              {/* WhatsApp */}
              <button
                onClick={shareOnWhatsApp}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-10 transition"
                title="WhatsApp"
              >
                <svg className="w-6 h-6" fill={themeColor} viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </button>

              {/* Télécharger */}
              <button
                onClick={downloadImage}
                disabled={isDownloading}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-10 transition disabled:opacity-50"
                title="Télécharger"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Autres */}
              <button
                onClick={shareOther}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-white hover:bg-opacity-10 transition"
                title="Autres"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke={themeColor} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-gray-800">
            <p className="text-xs text-gray-400 font-medium text-center">
              pronohub.club
            </p>
          </div>
        </div>
      </div>

      {/* Styles pour l'animation des étoiles qui tombent */}
      <style jsx>{`
        @keyframes fall-star {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(calc(100vh + 20px)) rotate(360deg);
            opacity: 0;
          }
        }

        .animate-fall-star {
          animation: fall-star linear infinite;
        }
      `}</style>
    </div>
  )
}
