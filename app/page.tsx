'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import Footer from '@/components/Footer'

// Landing page "Coming Soon" pour la production
function ComingSoonPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-black via-gray-950 to-black auth-page">
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8 p-8">
          <div className="flex flex-col items-center">
            <Image
              src="/images/king.svg"
              alt="Couronne"
              width={200}
              height={200}
              className="h-auto mb-2 drop-shadow-[0_0_80px_rgba(255,220,150,0.8)]"
              priority
            />
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={200}
              height={200}
              className="h-32 w-auto drop-shadow-[0_0_120px_rgba(255,220,150,0.7)]"
              priority
            />
          </div>
          <h2 className="text-4xl font-bold text-white drop-shadow-lg">
            Fais-toi plaisir,<br />deviens le roi du prono.
          </h2>
          <p className="text-lg text-gray-300">
            PronoHub : tournois de pronostics entre amis
          </p>

          {/* Badge Coming Soon */}
          <div className="mt-8">
            <span className="inline-block px-6 py-3 bg-[#ff9900]/20 border-2 border-[#ff9900] rounded-full text-[#ff9900] font-bold text-xl animate-pulse">
              Bientôt disponible
            </span>
          </div>

          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Nous préparons quelque chose d'exceptionnel pour toi. Reviens bientôt !
          </p>
        </div>
      </main>
      <Footer variant="minimal" />
    </div>
  )
}

// Page normale avec inscription/connexion
function NormalHomePage() {
  const logoRef = useRef<HTMLDivElement>(null)
  const [logoWidth, setLogoWidth] = useState<number>(0)

  useEffect(() => {
    if (logoRef.current) {
      const updateWidth = () => {
        const img = logoRef.current?.querySelector('img')
        if (img) {
          setLogoWidth(img.offsetWidth)
        }
      }

      // Attendre que l'image soit chargée
      const img = logoRef.current.querySelector('img')
      if (img) {
        if (img.complete) {
          updateWidth()
        } else {
          img.onload = updateWidth
        }
      }

      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-black via-gray-950 to-black auth-page">
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8 p-8">
          <div className="flex flex-col items-center">
            <Image
              src="/images/king.svg"
              alt="Couronne"
              width={200}
              height={200}
              className="h-auto mb-2 drop-shadow-[0_0_80px_rgba(255,220,150,0.8)]"
              style={{ width: logoWidth > 0 ? `${logoWidth}px` : 'auto' }}
            />
            <div ref={logoRef}>
              <Image
                src="/images/logo.svg"
                alt="PronoHub"
                width={200}
                height={200}
                className="h-32 w-auto drop-shadow-[0_0_120px_rgba(255,220,150,0.7)]"
              />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white drop-shadow-lg">
            Fais-toi plaisir,<br />deviens le roi du prono.
          </h2>
          <p className="text-lg text-gray-300">
            PronoHub : tournois de pronostics entre amis
          </p>
          <div className="flex justify-center items-center gap-3 flex-wrap mt-8">
            <Link
              href="/auth/signup"
              className="font-semibold text-base border-none rounded-lg px-7 py-3 cursor-pointer transition-all duration-[250ms] ease-[ease] bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_10px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_16px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 w-44 text-center"
            >
              S'inscrire
            </Link>
            <Link
              href="/auth/login"
              className="font-semibold text-base border-none rounded-lg px-7 py-3 cursor-pointer transition-all duration-[250ms] ease-[ease] bg-[#1a1a1a] text-white shadow-[0_0_10px_rgba(0,0,0,0.4)] hover:bg-[#333333] hover:shadow-[0_0_16px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 w-44 text-center"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </main>
      <Footer variant="minimal" />
    </div>
  )
}

export default function Home() {
  // En production (MAINTENANCE_MODE=true), afficher la landing page
  // En local, afficher la page normale
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'

  if (isMaintenanceMode) {
    return <ComingSoonPage />
  }

  return <NormalHomePage />
}
