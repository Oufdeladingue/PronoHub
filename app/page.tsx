'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Landing page "Coming Soon" pour la production
function ComingSoonPage() {
  // Status bar configurée en noir nativement dans MainActivity.java

  return (
    <div className="h-screen-safe flex flex-col bg-gradient-to-br from-black via-gray-950 to-black auth-page pt-safe overflow-hidden">
      <main id="main-content" className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-8 p-8">
          <div className="flex flex-col items-center">
            <Image
              src="/images/king.svg"
              alt="Couronne dorée PronoHub"
              width={200}
              height={200}
              className="h-auto mb-2 drop-shadow-[0_0_80px_rgba(255,220,150,0.8)]"
              priority
            />
            <Image
              src="/images/logo.svg"
              alt="PronoHub - Tournois de pronostics entre amis"
              width={200}
              height={200}
              className="h-32 w-auto drop-shadow-[0_0_120px_rgba(255,220,150,0.7)]"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Fais-toi plaisir,<br />deviens le roi du prono.
          </h1>
          <p className="text-lg text-gray-200">
            PronoHub : tournois de pronostics entre amis
          </p>

          {/* Badge Coming Soon */}
          <div className="mt-8">
            <span className="inline-block px-6 py-3 bg-[#ff9900]/20 border-2 border-[#ff9900] rounded-full text-[#ff9900] font-bold text-xl animate-pulse">
              Bientôt disponible
            </span>
          </div>

          <p className="text-gray-300 text-sm max-w-md mx-auto">
            Nous préparons quelque chose d'exceptionnel pour toi. Reviens bientôt !
          </p>
        </div>
      </main>
      {/* Footer minimal inline pour éviter la zone grise */}
      <div className="text-center py-2 text-[10px] text-gray-500">
        © {new Date().getFullYear()} PronoHub
        <span className="mx-2">•</span>
        <Link href="/cgv" className="hover:text-[#ff9900]">CGU</Link>
        <span className="mx-2">•</span>
        <Link href="/privacy" className="hover:text-[#ff9900]">Confidentialité</Link>
        <span className="mx-2">•</span>
        <Link href="/about" className="hover:text-[#ff9900]">À propos</Link>
      </div>
    </div>
  )
}

// Page normale avec inscription/connexion
function NormalHomePage() {
  const logoRef = useRef<HTMLDivElement>(null)
  const [logoWidth, setLogoWidth] = useState<number>(0)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté (important pour Capacitor)
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      console.log('[HomePage] Session check:', session ? 'logged in' : 'not logged in')

      if (session) {
        console.log('[HomePage] User already logged in, redirecting to dashboard')
        router.replace('/dashboard')
      } else {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    // Status bar configurée en noir nativement dans MainActivity.java

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

  // Afficher un loader pendant la vérification d'auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-950 to-black">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
      </div>
    )
  }

  return (
    <div className="h-screen-safe flex flex-col bg-gradient-to-br from-black via-gray-950 to-black auth-page pt-safe overflow-hidden">
      <main id="main-content" className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-6 p-6">
          <div className="flex flex-col items-center">
            <Image
              src="/images/king.svg"
              alt="Couronne dorée PronoHub"
              width={160}
              height={160}
              className="h-auto mb-2 drop-shadow-[0_0_60px_rgba(255,220,150,0.7)]"
              style={{ width: logoWidth > 0 ? `${logoWidth * 0.8}px` : 'auto' }}
              priority
            />
            <div ref={logoRef}>
              <Image
                src="/images/logo.svg"
                alt="PronoHub - Tournois de pronostics entre amis"
                width={160}
                height={160}
                className="w-auto drop-shadow-[0_0_100px_rgba(255,220,150,0.6)]"
                style={{ height: '6.4rem' }}
                priority
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            Fais-toi plaisir,<br />deviens le roi du prono.
          </h1>
          <p className="text-lg text-gray-200">
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
      {/* Footer minimal inline pour éviter la zone grise */}
      <div className="text-center py-2 text-[10px] text-gray-500">
        © {new Date().getFullYear()} PronoHub
        <span className="mx-2">•</span>
        <Link href="/cgv" className="hover:text-[#ff9900]">CGU</Link>
        <span className="mx-2">•</span>
        <Link href="/privacy" className="hover:text-[#ff9900]">Confidentialité</Link>
        <span className="mx-2">•</span>
        <Link href="/about" className="hover:text-[#ff9900]">À propos</Link>
      </div>
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
