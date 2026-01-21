'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Footer from '@/components/Footer'

export default function ChooseUsernamePage() {
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signup')
      }
    }
    checkUser()
  }, [])

  // Fonction de vérification de la disponibilité du nom d'utilisateur
  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) {
      setUsernameAvailable(null)
      return
    }

    setCheckingUsername(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', usernameToCheck)
        .limit(1)

      if (error) {
        console.error('Error checking username:', error)
        setUsernameAvailable(null)
      } else {
        setUsernameAvailable(data.length === 0)
      }
    } catch (err) {
      console.error('Error checking username:', err)
      setUsernameAvailable(null)
    } finally {
      setCheckingUsername(false)
    }
  }

  // Gestionnaire de changement du nom d'utilisateur
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 12) // Limiter à 12 caractères
    setUsername(value)

    if (value.length < 3) {
      setUsernameAvailable(null)
    }
  }

  // useEffect pour débouncer la vérification de disponibilité
  useEffect(() => {
    if (username.length >= 3) {
      const timeoutId = setTimeout(() => {
        checkUsernameAvailability(username)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [username])

  // Calcul dynamique de l'espacement des lettres basé sur la longueur du pseudo
  const getLetterSpacing = (username: string) => {
    if (username.length <= 6) return '0.15em'
    if (username.length <= 9) return '0.05em'
    return '0.02em'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Validation du nom d'utilisateur
    if (username.length < 3) {
      setError('Le nom d\'utilisateur doit contenir au moins 3 caractères')
      setLoading(false)
      return
    }

    if (usernameAvailable === false) {
      setError('Ce nom d\'utilisateur est déjà pris')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Utilisateur non connecté')

      // Créer ou mettre à jour le profil avec le nom d'utilisateur et l'email
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: username,
          email: user.email,
          updated_at: new Date().toISOString(),
        })

      if (profileError) throw profileError

      // Envoyer l'email de bienvenue (en arrière-plan, on n'attend pas la réponse)
      fetch('/api/email/welcome', { method: 'POST' }).catch(console.error)

      // Rediriger vers le dashboard
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col auth-page">
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden"
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

        <div className="relative z-10 w-full max-w-[420px] rounded-[14px] p-10 shadow-[0_15px_50px_rgba(0,0,0,0.75)] auth-card-bg">
          <h1 className="text-2xl font-bold text-center mb-4 text-white flex items-center justify-center gap-2">
            Choisis ton flocage
          </h1>

          <p className="text-center text-gray-400 mb-6">
            Il te suivra toute ta carrière
          </p>

          {/* Maillot avec flocage dynamique */}
          <div className="relative w-48 h-56 mx-auto mb-6">
            <img
              src="/images/jersey-auth.png"
              alt="Maillot"
              className="w-full h-full object-contain"
            />
            {/* Texte du flocage */}
            {username && (
              <div className="absolute top-[17%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                <p
                  className="text-black font-black text-sm tracking-wider uppercase"
                  style={{
                    textShadow: '1px 1px 2px rgba(255,255,255,0.3)',
                    letterSpacing: getLetterSpacing(username),
                    fontFamily: 'Arial Black, sans-serif',
                    transform: 'scaleY(1.1)',
                  }}
                >
                  {username}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600/50 text-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                required
                maxLength={12}
                minLength={3}
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 text-[15px] transition-all duration-[250ms] placeholder-[#888] bg-[#1a1a1a] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                placeholder="john_doe"
              />
              {username.length > 0 && (
                <div className="mt-2">
                  {checkingUsername && (
                    <p className="text-xs text-gray-400">Vérification...</p>
                  )}
                  {!checkingUsername && username.length >= 3 && usernameAvailable === true && (
                    <p className="text-xs text-green-400">✓ ça sent le futur ballon d'or</p>
                  )}
                  {!checkingUsername && username.length >= 3 && usernameAvailable === false && (
                    <p className="text-xs text-red-400">✗ Ce nom d'utilisateur est déjà pris</p>
                  )}
                  {username.length < 3 && (
                    <p className="text-xs text-gray-400">Au moins 3 caractères requis</p>
                  )}
                  <p className="text-xs text-[#666] mt-0.5">3 à 12 caractères max</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || usernameAvailable !== true}
              className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? 'Enregistrement...' : 'Valider'}
            </button>
          </form>
        </div>
      </div>
      <Footer variant="minimal" />
    </div>
  )
}
