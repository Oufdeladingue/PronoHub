'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 auth-page">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-gray-900 flex items-center justify-center gap-2">
          Choisis ton flocage
        </h1>

        <p className="text-center text-gray-600 mb-6">
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
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
              placeholder="john_doe"
            />
            {username.length > 0 && (
              <div className="mt-1">
                {checkingUsername && (
                  <p className="text-xs text-gray-500">Vérification...</p>
                )}
                {!checkingUsername && username.length >= 3 && usernameAvailable === true && (
                  <p className="text-xs text-green-600">✓ ça sent le futur ballon d'or</p>
                )}
                {!checkingUsername && username.length >= 3 && usernameAvailable === false && (
                  <p className="text-xs text-red-600">✗ Ce nom d'utilisateur est déjà pris</p>
                )}
                {username.length < 3 && (
                  <p className="text-xs text-gray-500">Au moins 3 caractères requis</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">3 à 12 caractères max</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || usernameAvailable !== true}
            className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement...' : 'Valider'}
          </button>
        </form>
      </div>
    </div>
  )
}
