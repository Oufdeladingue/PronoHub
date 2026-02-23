'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { trackUsernameChosen } from '@/lib/analytics'

function ChooseUsernameForm() {
  const [newUsername, setNewUsername] = useState('')
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [savingUsername, setSavingUsername] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')
  const supabase = createClient()

  // Vérifier que l'utilisateur est connecté et n'a pas déjà choisi son pseudo
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('has_chosen_username')
        .eq('id', user.id)
        .single()

      if (profile?.has_chosen_username === true) {
        router.replace(redirectTo || '/dashboard')
        return
      }

      setLoading(false)
    }
    checkUser()
  }, [])

  // Vérification de disponibilité du pseudo (debounce 500ms)
  useEffect(() => {
    if (newUsername.length >= 3) {
      const timeout = setTimeout(async () => {
        setCheckingUsername(true)
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('username')
            .ilike('username', newUsername)
            .limit(1)
          if (!error) {
            setUsernameAvailable(data.length === 0)
          }
        } catch {
          setUsernameAvailable(null)
        } finally {
          setCheckingUsername(false)
        }
      }, 500)
      return () => clearTimeout(timeout)
    } else {
      setUsernameAvailable(null)
    }
  }, [newUsername])

  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.slice(0, 12)
    setNewUsername(value)
    if (value.length < 3) setUsernameAvailable(null)
  }, [])

  const getLetterSpacing = (name: string) => {
    if (name.length <= 6) return '0.15em'
    if (name.length <= 9) return '0.05em'
    return '0.02em'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUsernameError(null)
    if (newUsername.length < 3) {
      setUsernameError('Au moins 3 caractères requis')
      return
    }
    if (usernameAvailable !== true) {
      setUsernameError('Ce nom d\'utilisateur est déjà pris')
      return
    }

    setSavingUsername(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: newUsername,
          email: user.email,
          has_chosen_username: true,
          updated_at: new Date().toISOString(),
        })
      if (profileError) throw profileError

      // Envoyer l'email de bienvenue en arrière-plan
      fetch('/api/email/welcome', { method: 'POST' }).catch(console.error)

      trackUsernameChosen()
      router.replace(redirectTo || '/dashboard')
    } catch (err: any) {
      setUsernameError(err.message)
    } finally {
      setSavingUsername(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="loading-spinner-inline"></div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col auth-page bg-black overflow-y-auto">
      {/* Image de fond */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/bg-step-1.jpg"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
      </div>

      {/* Contenu centré */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-[14px] p-8 shadow-[0_15px_50px_rgba(0,0,0,0.75)] bg-[#1a1a2e] border border-white/10">
          <h2 className="text-2xl font-bold text-center mb-2 text-white">
            Choisis ton flocage
          </h2>
          <p className="text-center text-gray-400 mb-6 text-sm">
            Il te suivra toute ta carrière
          </p>

          {/* Maillot avec flocage dynamique */}
          <div className="relative w-40 h-48 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full blur-[40px] opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(255, 200, 100, 0.6) 0%, rgba(255, 153, 0, 0.3) 50%, transparent 70%)",
                transform: "scale(1.2)"
              }}
            />
            <img
              src="/images/jersey-auth.png"
              alt="Maillot"
              className="relative w-full h-full object-contain drop-shadow-[0_0_20px_rgba(255,180,50,0.4)]"
            />
            {newUsername && (
              <div className="absolute top-[17%] left-1/2 -translate-x-1/2 -translate-y-1/2">
                <p
                  className="text-black font-black text-sm tracking-wider uppercase"
                  style={{
                    textShadow: '1px 1px 2px rgba(255,255,255,0.3)',
                    letterSpacing: getLetterSpacing(newUsername),
                    fontFamily: 'Arial Black, sans-serif',
                    transform: 'scaleY(1.1)',
                  }}
                >
                  {newUsername}
                </p>
              </div>
            )}
          </div>

          {usernameError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600/50 text-red-200 rounded-lg text-sm">
              {usernameError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={newUsername}
                onChange={handleUsernameChange}
                required
                maxLength={12}
                minLength={3}
                autoFocus
                className="auth-input bg-[#1a1a1a]"
                placeholder="john_doe"
              />
              {newUsername.length > 0 && (
                <div className="mt-2">
                  {checkingUsername && (
                    <p className="text-xs text-gray-400">Vérification...</p>
                  )}
                  {!checkingUsername && newUsername.length >= 3 && usernameAvailable === true && (
                    <p className="text-xs text-green-400">&#10003; ça sent le futur ballon d&apos;or</p>
                  )}
                  {!checkingUsername && newUsername.length >= 3 && usernameAvailable === false && (
                    <p className="text-xs text-red-400">&#10007; Ce nom d&apos;utilisateur est déjà pris</p>
                  )}
                  {newUsername.length < 3 && (
                    <p className="text-xs text-gray-400">Au moins 3 caractères requis</p>
                  )}
                  <p className="text-xs text-[#666] mt-0.5">3 à 12 caractères max</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingUsername || usernameAvailable !== true}
              className="auth-btn-primary disabled:shadow-none"
            >
              {savingUsername ? 'Enregistrement...' : 'Valider'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function ChooseUsernamePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <div className="loading-spinner-inline"></div>
      </div>
    }>
      <ChooseUsernameForm />
    </Suspense>
  )
}
