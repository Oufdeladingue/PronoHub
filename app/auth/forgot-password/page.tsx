'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'envoi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#111' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Mot de passe oublié</h1>
          <p className="text-gray-400 text-sm">
            Entre ton adresse email et on t'envoie un lien pour réinitialiser ton mot de passe.
          </p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 text-center">
            <p className="text-green-400 mb-4">
              Un email de réinitialisation a été envoyé à <strong>{email}</strong>.
              Vérifie ta boîte de réception (et les spams).
            </p>
            <Link
              href="/auth/login"
              className="text-[#ff9900] hover:text-[#e68a00] text-sm transition-colors"
            >
              Retour à la connexion
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-[#2f2f2f] rounded-lg text-white px-3.5 py-3 text-[15px] transition-all duration-[250ms] placeholder-[#888] focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] focus:outline-none"
                style={{ background: '#1a1a1a' }}
                placeholder="ton@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
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
