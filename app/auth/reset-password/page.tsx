'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Supabase échange automatiquement le token de l'URL pour une session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
  }, [supabase.auth])

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

  const validation = validatePassword(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validation.isValid) {
      setError('Le mot de passe ne respecte pas les critères requis.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#111' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Nouveau mot de passe</h1>
          <p className="text-gray-400 text-sm">
            Choisis un nouveau mot de passe pour ton compte.
          </p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
            <p className="text-green-400 mb-4">
              Mot de passe mis à jour ! Tu vas être redirigé vers la connexion...
            </p>
            <Link
              href="/auth/login"
              className="text-[#ff9900] hover:text-[#e68a00] text-sm transition-colors"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Nouveau mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                style={{ background: '#1a1a1a' }}
                placeholder="••••••••"
              />
              {password && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs ${validation.hasMinLength ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasMinLength ? '✓' : '○'} 8 caractères minimum
                  </p>
                  <p className={`text-xs ${validation.hasUpperCase ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasUpperCase ? '✓' : '○'} Une lettre majuscule
                  </p>
                  <p className={`text-xs ${validation.hasLowerCase ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasLowerCase ? '✓' : '○'} Une lettre minuscule
                  </p>
                  <p className={`text-xs ${validation.hasNumber ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasNumber ? '✓' : '○'} Un chiffre
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-300 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                style={{ background: '#1a1a1a' }}
                placeholder="••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !validation.isValid || password !== confirmPassword}
              className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Mise à jour...' : 'Réinitialiser le mot de passe'}
            </button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
