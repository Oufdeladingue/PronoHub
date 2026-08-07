'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function ResetPasswordPage() {
  const t = useTranslations('Auth')
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
      setError(t('resetPassword.errCriteria'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.errMismatch'))
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 3000)
    } catch (err: any) {
      setError(err.message || t('resetPassword.errReset'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#111' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('resetPassword.title')}</h1>
          <p className="text-gray-400 text-sm">
            {t('resetPassword.subtitle')}
          </p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
            <p className="text-green-400 mb-4">
              {t('resetPassword.success')}
            </p>
            <Link
              href="/auth/login"
              className="text-[#ff9900] hover:text-[#e68a00] text-sm transition-colors"
            >
              {t('resetPassword.loginLink')}
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
                {t('resetPassword.passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="auth-input"
                style={{ background: '#1a1a1a' }}
                placeholder="••••••••"
              />
              {password && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs ${validation.hasMinLength ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasMinLength ? '✓' : '○'} {t('resetPassword.critMinLength')}
                  </p>
                  <p className={`text-xs ${validation.hasUpperCase ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasUpperCase ? '✓' : '○'} {t('signup.critUpper')}
                  </p>
                  <p className={`text-xs ${validation.hasLowerCase ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasLowerCase ? '✓' : '○'} {t('signup.critLower')}
                  </p>
                  <p className={`text-xs ${validation.hasNumber ? 'text-green-400' : 'text-gray-400'}`}>
                    {validation.hasNumber ? '✓' : '○'} {t('signup.critNumber')}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-300 mb-2">
                {t('signup.confirmPassword')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="auth-input"
                style={{ background: '#1a1a1a' }}
                placeholder="••••••••"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-400 mt-1">{t('errors.pwMismatch')}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !validation.isValid || password !== confirmPassword}
              className="auth-btn-primary"
            >
              {loading ? t('resetPassword.submitLoading') : t('resetPassword.submit')}
            </button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {t('forgotPassword.backToLogin')}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
