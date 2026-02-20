'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { isCapacitor, isNativeGoogleAuthAvailable, openExternalUrl, saveSessionToPreferences } from '@/lib/capacitor'
import { initGoogleAuth, signInWithGoogleNative } from '@/lib/google-auth'
import TurnstileWidget from '@/components/TurnstileWidget'
import AgeGate from '@/components/AgeGate'

function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptCGU, setAcceptCGU] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [titleFontSize, setTitleFontSize] = useState(16)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const urlError = searchParams.get('error')
  const supabase = createClient()

  // Afficher l'erreur passée en paramètre URL (ex: blocage pays OAuth)
  useEffect(() => {
    if (urlError) {
      setError(decodeURIComponent(urlError))
    }
  }, [urlError])

  // Initialiser Google Auth natif au montage (Capacitor Android)
  // Status bar configurée en noir nativement dans MainActivity.java
  useEffect(() => {
    if (isNativeGoogleAuthAvailable()) {
      initGoogleAuth()
    }
  }, [])

  // Ajustement automatique de la taille du titre
  useEffect(() => {
    const adjustTitleSize = () => {
      if (!titleRef.current || !containerRef.current) return

      const container = containerRef.current
      const title = titleRef.current
      const containerWidth = container.offsetWidth

      // Commencer avec une grande taille de police
      let fontSize = 48
      title.style.fontSize = `${fontSize}px`

      // Réduire la taille jusqu'à ce que le texte tienne sur une ligne
      while (title.scrollWidth > containerWidth && fontSize > 12) {
        fontSize -= 0.5
        title.style.fontSize = `${fontSize}px`
      }

      setTitleFontSize(fontSize)
    }

    adjustTitleSize()
    window.addEventListener('resize', adjustTitleSize)

    return () => {
      window.removeEventListener('resize', adjustTitleSize)
    }
  }, [])

  // Fonction de validation du mot de passe
  const validatePassword = (pwd: string) => {
    const hasMinLength = pwd.length >= 8
    const hasUpperCase = /[A-Z]/.test(pwd)
    const hasLowerCase = /[a-z]/.test(pwd)
    const hasNumber = /\d/.test(pwd)

    return {
      isValid: hasMinLength && hasUpperCase && hasLowerCase && hasNumber,
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumber,
    }
  }

  // Calcul de la force du mot de passe (0-100)
  const getPasswordStrength = (pwd: string) => {
    const validation = validatePassword(pwd)
    let strength = 0

    if (validation.hasMinLength) strength += 25
    if (validation.hasUpperCase) strength += 25
    if (validation.hasLowerCase) strength += 25
    if (validation.hasNumber) strength += 25

    return strength
  }

  const passwordValidation = validatePassword(password)
  const passwordStrength = getPasswordStrength(password)

  // Gestion de l'authentification OAuth
  const handleOAuthSignIn = async (provider: 'google') => {
    setError(null)
    setGoogleLoading(true)

    try {
      // Vérifier la restriction par pays avant OAuth (via Cloudflare cf-ipcountry)
      try {
        const countryCheck = await fetch('/api/auth/check-country')
        const countryData = await countryCheck.json()
        if (!countryData.allowed) {
          setError(countryData.message || "PronoHub n'est pas encore disponible dans votre pays.")
          setGoogleLoading(false)
          return
        }
      } catch {
        // Fail-open : si la vérification échoue, on laisse passer
      }

      // CAS 1: Google Sign-In natif Android (popup native)
      if (provider === 'google' && isNativeGoogleAuthAvailable()) {
        try {
          const googleUser = await signInWithGoogleNative()

          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: googleUser.authentication.idToken,
            access_token: googleUser.authentication.accessToken,
          })

          if (error) {
            throw error
          }

          await saveSessionToPreferences()

          // Vérifier si l'utilisateur a déjà un pseudo
          if (data.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('has_chosen_username')
              .eq('id', data.user.id)
              .single()

            if (profile && profile.has_chosen_username === false) {
              // Compte OAuth sans pseudo choisi → choisir un pseudo
              router.push(redirectTo ? `/auth/choose-username?redirectTo=${encodeURIComponent(redirectTo)}` : '/auth/choose-username')
              return
            }
          }

          const redirectPath = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
          router.push(redirectPath)
          return

        } catch (nativeError: unknown) {
          const errorMessage = nativeError instanceof Error ? nativeError.message : String(nativeError)

          if (errorMessage.includes('annulée') || errorMessage.includes('canceled')) {
            setGoogleLoading(false)
            return
          }

          console.error('[Auth] Erreur Google natif:', nativeError)
          // Fallback vers OAuth browser
        }
      }

      // CAS 2: OAuth classique (web ou fallback)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const apiUrl = redirectTo
        ? `${baseUrl}/api/auth/${provider}?redirectTo=${encodeURIComponent(redirectTo)}`
        : `${baseUrl}/api/auth/${provider}`

      if (isCapacitor()) {
        await openExternalUrl(apiUrl)
      } else {
        window.location.href = apiUrl
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(errorMessage)
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation du mot de passe
    if (!passwordValidation.isValid) {
      setError('Le mot de passe ne respecte pas les critères de sécurité')
      setLoading(false)
      return
    }

    // Vérification de la confirmation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setLoading(false)
      return
    }

    try {
      // Vérifier la restriction par pays avant inscription (via Cloudflare cf-ipcountry)
      try {
        const countryCheck = await fetch('/api/auth/check-country')
        const countryData = await countryCheck.json()
        if (!countryData.allowed) {
          setError(countryData.message || "PronoHub n'est pas encore disponible dans votre pays.")
          setLoading(false)
          return
        }
      } catch {
        // Fail-open : si la vérification échoue, on laisse passer
      }

      // Vérifier Turnstile (si configuré)
      if (turnstileToken) {
        try {
          const turnstileCheck = await fetch('/api/auth/verify-turnstile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: turnstileToken }),
          })
          const turnstileData = await turnstileCheck.json()
          if (!turnstileData.success) {
            setError('La vérification anti-bot a échoué. Veuillez réessayer.')
            setLoading(false)
            return
          }
        } catch {
          // Fail-open
        }
      }

      // Stocker l'email et le redirectTo temporairement
      sessionStorage.setItem('pendingEmail', email)
      if (redirectTo) {
        sessionStorage.setItem('authRedirectTo', redirectTo)
      }

      // Passer le redirectTo au callback si présent
      const callbackUrl = redirectTo
        ? `${window.location.origin}/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`
        : `${window.location.origin}/auth/callback`

      // Créer le compte immédiatement (Supabase enverra l'email OTP automatiquement)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
        },
      })

      if (signUpError) {
        throw signUpError
      }

      // Rediriger vers la page de vérification (avec redirectTo si présent)
      router.push(redirectTo ? `/auth/verify-code?redirectTo=${encodeURIComponent(redirectTo)}` : '/auth/verify-code')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Afficher un loader plein écran pendant Google Sign-In
  if (googleLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black z-50">
        <div className="flex flex-col items-center gap-8">
          {/* Logo PronoHub */}
          <div className="relative">
            <Image
              src="/images/logo.svg"
              alt="PronoHub"
              width={120}
              height={120}
              className="w-24 h-24 md:w-32 md:h-32"
            />
            {/* Cercle de chargement tournant */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-28 h-28 md:w-36 md:h-36 border-4 border-[#ff9900]/20 border-t-[#ff9900] rounded-full animate-spin"></div>
            </div>
          </div>

          {/* Message de connexion Google */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-[#ff9900] text-xl font-semibold">Connexion avec Google</span>
            <span className="text-gray-400 text-sm text-center px-4">Authentification en cours...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col auth-page bg-black overflow-y-auto">
      <div
        className="flex-1 flex items-center justify-center relative px-4 py-4"
        style={{
          backgroundImage: "url('/images/room-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
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
        <div className="flex items-center justify-center gap-2 mb-3">
          <h1 className="text-lg font-bold text-white m-0">
            Rejoins l'effectif
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

        <form onSubmit={handleSignUp} className="space-y-3">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-[#2f2f2f] rounded-lg text-white px-3 py-2 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
              placeholder="vous@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 pr-10 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <img
                  src={showPassword ? '/images/icons/eye-closed.svg' : '/images/icons/eye-open.svg'}
                  alt={showPassword ? 'Masquer' : 'Afficher'}
                  className="w-5 h-5"
                />
              </button>
            </div>

            {/* Barre de force du mot de passe */}
            {password && (
              <div className="mt-2">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength <= 25 ? 'bg-red-500' :
                      passwordStrength <= 50 ? 'bg-orange-500' :
                      passwordStrength <= 75 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  passwordStrength <= 25 ? 'text-red-600' :
                  passwordStrength <= 50 ? 'text-orange-600' :
                  passwordStrength <= 75 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  {passwordStrength <= 25 ? 'Faible' :
                   passwordStrength <= 50 ? 'Moyen' :
                   passwordStrength <= 75 ? 'Bon' :
                   'Fort'}
                </p>
              </div>
            )}

            {/* Critères de validation */}
            <div className="mt-2 space-y-1">
              <p className={`text-xs ${passwordValidation.hasMinLength ? 'text-green-400' : 'text-gray-400'}`}>
                {passwordValidation.hasMinLength ? '✓' : '○'} Au moins 8 caractères
              </p>
              <p className={`text-xs ${passwordValidation.hasUpperCase ? 'text-green-400' : 'text-gray-400'}`}>
                {passwordValidation.hasUpperCase ? '✓' : '○'} Une lettre majuscule
              </p>
              <p className={`text-xs ${passwordValidation.hasLowerCase ? 'text-green-400' : 'text-gray-400'}`}>
                {passwordValidation.hasLowerCase ? '✓' : '○'} Une lettre minuscule
              </p>
              <p className={`text-xs ${passwordValidation.hasNumber ? 'text-green-400' : 'text-gray-400'}`}>
                {passwordValidation.hasNumber ? '✓' : '○'} Un chiffre
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 pr-10 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                <img
                  src={showConfirmPassword ? '/images/icons/eye-closed.svg' : '/images/icons/eye-open.svg'}
                  alt={showConfirmPassword ? 'Masquer' : 'Afficher'}
                  className="w-5 h-5"
                />
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="text-xs text-green-400 mt-1">✓ Les mots de passe correspondent</p>
            )}
          </div>

          <div className="flex items-start gap-2">
            <input
              id="accept-cgu"
              type="checkbox"
              checked={acceptCGU}
              onChange={(e) => setAcceptCGU(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#ff9900] cursor-pointer shrink-0"
            />
            <label htmlFor="accept-cgu" className="text-xs text-gray-400 cursor-pointer leading-relaxed">
              J'accepte les{' '}
              <Link href="/cgv" target="_blank" className="text-[#ffb84d] hover:text-[#ff9900] underline">
                Conditions Générales d'Utilisation
              </Link>{' '}
              et la{' '}
              <Link href="/privacy" target="_blank" className="text-[#ffb84d] hover:text-[#ff9900] underline">
                Politique de confidentialité
              </Link>
            </label>
          </div>

          {/* Cloudflare Turnstile (anti-bot) — affiché seulement si configuré */}
          <TurnstileWidget
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />

          <button
            type="submit"
            disabled={loading || !acceptCGU}
            className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
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

        {/* Bouton de connexion sociale */}
        <button
          onClick={() => {
            if (!acceptCGU) {
              setError('Veuillez accepter les CGU et la politique de confidentialité')
              return
            }
            handleOAuthSignIn('google')
          }}
          className={`w-full flex items-center justify-center gap-3 py-3 px-4 border border-[#2f2f2f] rounded-lg transition-all duration-[250ms] ${acceptCGU ? 'bg-[#1a1a1a] hover:bg-[#222]' : 'bg-[#1a1a1a] opacity-60 cursor-not-allowed'}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="text-white font-medium">Continuer avec Google</span>
        </button>

        <p className="text-center mt-[18px] text-sm text-[#888]">
          Déjà un compte ?{' '}
          <Link href={redirectTo ? `/auth/login?redirectTo=${encodeURIComponent(redirectTo)}` : '/auth/login'} className="text-[#ffb84d] no-underline font-medium transition-colors duration-200 hover:text-[#ff9900] hover:underline">
            Se connecter
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

export default function SignUpPage() {
  return (
    <AgeGate>
      <Suspense fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-black">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
        </div>
      }>
        <SignUpForm />
      </Suspense>
    </AgeGate>
  )
}
