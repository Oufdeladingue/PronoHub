'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/Footer'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Appeler l'API pour gérer la connexion avec email ou username
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

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
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
        <div className="flex items-center justify-center gap-3 mb-7">
          <h1 className="text-2xl font-bold text-white m-0">
            Rejoins le vestiaire
          </h1>
          <Image
            src="/images/logo.svg"
            alt="PronoHub"
            width={80}
            height={80}
            className="h-10 w-auto"
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

        <p className="text-center mt-[18px] text-sm text-[#888]">
          Pas encore de compte ?{' '}
          <Link href="/auth/signup" className="text-[#ffb84d] no-underline font-medium transition-colors duration-200 hover:text-[#ff9900] hover:underline">
            S'inscrire
          </Link>
        </p>
      </div>
      </div>
      <Footer variant="minimal" />
    </div>
  )
}
