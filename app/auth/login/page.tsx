'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { isCapacitor, isNativeGoogleAuthAvailable, openExternalUrl, saveSessionToPreferences } from '@/lib/capacitor'
import { initGoogleAuth, signInWithGoogleNative } from '@/lib/google-auth'

function LoginForm() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [loadingPercent, setLoadingPercent] = useState(0)
  const [loadingMessage, setLoadingMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const supabase = createClient()

  // Phrases de chargement aléatoires
  const loadingMessages = [
    'On chauffe les crampons…',
    'Le ballon est encore chez l\'arbitre, on va le récupérer…',
    'On vérifie si la VAR valide le chargement…',
    'Le serveur s\'est pris un petit pont, il revient…',
    'On fait un changement… chargement incoming.',
    'On cherche la connexion… elle s\'est cachée derrière la défense.',
    'On temporise… comme Giroud dos au jeu.',
    'Réchauffage : nos serveurs tirent des coups francs.',
    'On attend que le gardien arrête de chambrer.',
    'On prépare une occasion… faut juste cadrer le chargement.',
    'On repasse par derrière… ça charge mieux.',
    'Le match reprend dans un instant… promesse d\'arbitre.',
    'Système en place : 4-4-2… 4 secondes, 4 infos, 2 cafés.',
    'On fait circuler les données… tiki-taka de chargement.'
  ]

  // Vérifier si l'utilisateur est déjà connecté (redirection auto)
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[LoginPage] Session check:', session ? 'logged in' : 'not logged in')

      if (session) {
        console.log('[LoginPage] User already logged in, redirecting to dashboard')
        router.replace(redirectTo || '/dashboard')
      }
    }

    checkAuth()
  }, [router, redirectTo, supabase])

  // Initialiser Google Auth natif au montage (Capacitor Android)
  // Status bar configurée en noir nativement dans MainActivity.java
  useEffect(() => {
    if (isNativeGoogleAuthAvailable()) {
      initGoogleAuth()
    }
  }, [])

  // Animation du pourcentage de chargement
  useEffect(() => {
    if (redirecting) {
      // Choisir une phrase aléatoire au début
      setLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)])

      const interval = setInterval(() => {
        setLoadingPercent(prev => {
          // Accélérer progressivement jusqu'à 90%, puis ralentir
          if (prev < 60) return prev + 3
          if (prev < 85) return prev + 2
          if (prev < 95) return prev + 0.5
          return prev
        })
      }, 50)
      return () => clearInterval(interval)
    }
  }, [redirecting])

  // Gestion de l'authentification OAuth Google
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError(null)

    try {
      // CAS 1: Google Sign-In natif Android (popup native)
      if (isNativeGoogleAuthAvailable()) {
        try {
          // Obtenir l'idToken via le SDK natif Google
          const googleUser = await signInWithGoogleNative()

          // Authentifier avec Supabase via idToken
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleUser.authentication.idToken,
            access_token: googleUser.authentication.accessToken,
          })

          if (error) {
            throw error
          }

          // Sauvegarder la session dans Capacitor Preferences pour persistance
          await saveSessionToPreferences()

          // Vérifier le rôle pour la redirection
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single()

          const redirectPath = redirectTo
            ? decodeURIComponent(redirectTo)
            : (profile?.role === 'super_admin' ? '/sys-panel-svspgrn1kzw8' : '/dashboard')

          router.push(redirectPath)
          return

        } catch (nativeError: unknown) {
          const errorMessage = nativeError instanceof Error ? nativeError.message : String(nativeError)

          // Si l'utilisateur a annulé, ne pas afficher d'erreur
          if (errorMessage.includes('annulée') || errorMessage.includes('canceled')) {
            setGoogleLoading(false)
            return
          }

          console.error('[Auth] Erreur Google natif:', nativeError)
          // Fallback vers OAuth browser si erreur native
          console.log('[Auth] Fallback vers OAuth browser')
        }
      }

      // CAS 2: OAuth classique (web ou fallback Capacitor)
      // Utiliser la route API proxy pour masquer l'URL Supabase
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const apiUrl = redirectTo
        ? `${baseUrl}/api/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`
        : `${baseUrl}/api/auth/google`

      if (isCapacitor()) {
        // Sur Capacitor, ouvrir l'URL du proxy dans le navigateur externe
        await openExternalUrl(apiUrl)
      } else {
        // Sur le web, redirection classique vers le proxy
        window.location.href = apiUrl
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Dans Capacitor, utiliser directement le client Supabase pour que la session soit stockée en localStorage
      if (isCapacitor()) {
        // Déterminer si c'est un email ou un username
        const isEmail = identifier.includes('@')

        let email = identifier
        if (!isEmail) {
          // Chercher l'email correspondant au username via l'API
          const lookupResponse = await fetch('/api/auth/lookup-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: identifier }),
          })
          const lookupData = await lookupResponse.json()

          if (!lookupResponse.ok || !lookupData.email) {
            throw new Error('Utilisateur non trouvé')
          }
          email = lookupData.email
        }

        // Connexion directe via le client Supabase (stocke la session en localStorage)
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw new Error(error.message === 'Invalid login credentials'
            ? 'Email/pseudo ou mot de passe incorrect'
            : error.message)
        }

        // Sauvegarder la session dans Capacitor Preferences pour persistance
        await saveSessionToPreferences()

        // Vérifier le rôle pour la redirection
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()

        // Dans Capacitor, pas besoin d'afficher le loader ici car le dashboard a son propre loader
        setLoading(false)

        const redirectPath = redirectTo
          ? decodeURIComponent(redirectTo)
          : (profile?.role === 'super_admin' ? '/sys-panel-svspgrn1kzw8' : '/dashboard')
        router.push(redirectPath)
      } else {
        // Sur le web, utiliser l'API côté serveur (cookies)
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier,
            password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Erreur de connexion')
        }

        // Rafraîchir la session côté client
        await supabase.auth.refreshSession()

        // Afficher le loader de redirection
        setLoading(false)
        setRedirecting(true)

        // Utiliser redirectTo si présent, sinon rediriger selon le rôle
        const redirectPath = redirectTo
          ? decodeURIComponent(redirectTo)
          : (data.role === 'super_admin' ? '/sys-panel-svspgrn1kzw8' : '/dashboard')
        router.push(redirectPath)
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  // Afficher un loader plein écran pendant la redirection vers le dashboard
  if (redirecting) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-6">
          {/* Logo avec effet de remplissage de bas en haut */}
          <div className="relative w-24 h-24">
            {/* Logo grisé en fond */}
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={96}
              height={96}
              className="w-24 h-24 opacity-20 grayscale"
            />
            {/* Logo coloré qui se remplit de bas en haut */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{
                clipPath: `inset(${100 - loadingPercent}% 0 0 0)`
              }}
            >
              <Image
                src="/images/logo.svg"
                alt="PronoHub"
                width={96}
                height={96}
                className="w-24 h-24"
              />
            </div>
          </div>

          {/* Pourcentage */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[#ff9900] text-2xl font-bold">{Math.round(loadingPercent)}%</span>
            <span className="text-gray-400 text-sm text-center px-4">{loadingMessage}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col auth-page bg-black overflow-hidden">
      <div
        className="flex-1 flex items-center justify-center relative px-4"
        style={{
          backgroundImage: "url('/images/room-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          paddingTop: 'env(safe-area-inset-top, 0)',
          paddingBottom: 'env(safe-area-inset-bottom, 0)'
        }}
      >
      {/* Radial gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(255, 153, 0, 0.25) 0%, rgba(0, 0, 0, 0.85) 50%, #020308 100%)",
          zIndex: 0
        }}
      ></div>

      {/* Projecteurs gauche et droite */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/20 blur-[100px] rounded-full z-[1]"></div>
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 blur-[100px] rounded-full z-[1]"></div>

      <div className="relative z-10 w-full max-w-[380px] rounded-xl p-5 shadow-[0_15px_50px_rgba(0,0,0,0.75)] auth-card-bg">
        <div className="flex items-center justify-center gap-2 mb-4">
          <h1 className="text-lg font-bold text-white m-0">
            Rejoins le vestiaire
          </h1>
          <Image
            src="/images/logo.svg"
            alt="PronoHub"
            width={48}
            height={48}
            className="h-7 w-auto"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-600/50 text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">
              Email ou Pseudo
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 mb-4 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
              placeholder="adresse email ou pseudo"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 mb-4 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5 text-[#111]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Séparateur "OU" */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#2f2f2f]"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 text-gray-400 auth-divider-bg">OU</span>
          </div>
        </div>

        {/* Bouton de connexion Google */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-[#2f2f2f] rounded-lg bg-[#1a1a1a] hover:bg-[#222] transition-all duration-[250ms] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span className="text-white font-medium">
            {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
          </span>
        </button>

        <p className="text-center mt-[18px] text-sm text-[#888]">
          Pas encore de compte ?{' '}
          <Link href={redirectTo ? `/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}` : '/auth/signup'} className="text-[#ffb84d] no-underline font-medium transition-colors duration-200 hover:text-[#ff9900] hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
      </div>
      {/* Footer minimal inline */}
      <div className="text-center py-3 text-[10px] text-gray-400">
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
