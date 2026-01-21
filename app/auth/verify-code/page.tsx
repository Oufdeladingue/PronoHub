'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Footer from '@/components/Footer'

export default function VerifyCodePage() {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Récupérer l'email depuis le sessionStorage
    const pendingEmail = sessionStorage.getItem('pendingEmail')
    if (!pendingEmail) {
      router.push('/auth/signup')
      return
    }
    setEmail(pendingEmail)

    // Focus sur le premier champ
    inputRefs.current[0]?.focus()
  }, [router])

  const handleChange = (index: number, value: string) => {
    // Ne garder que le dernier chiffre saisi
    const digit = value.slice(-1)

    if (!/^\d*$/.test(digit)) return // Accepter seulement les chiffres

    const newCode = [...code]
    newCode[index] = digit
    setCode(newCode)

    // Passer au champ suivant si un chiffre a été saisi
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Si le champ est vide et qu'on appuie sur Backspace, revenir au champ précédent
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').trim()

    if (!/^\d{6}$/.test(pastedData)) {
      setError('Le code doit contenir exactement 6 chiffres')
      return
    }

    const newCode = pastedData.split('')
    setCode(newCode)
    inputRefs.current[5]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const verificationCode = code.join('')

    if (verificationCode.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code')
      setLoading(false)
      return
    }

    try {
      // Vérifier le code OTP (le compte a déjà été créé à l'étape précédente)
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'email',
      })

      if (verifyError) throw verifyError

      // Nettoyer le sessionStorage
      sessionStorage.removeItem('pendingEmail')

      // Rediriger vers la page de choix du pseudo
      router.push('/auth/choose-username')
    } catch (err: any) {
      setError(err.message || 'Code invalide ou expiré. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setResending(true)
    setError(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })

      if (error) throw error

      setError(null)
      // Afficher un message de succès temporaire
      const successMsg = 'Code renvoyé avec succès !'
      setError(successMsg)
      setTimeout(() => setError(null), 3000)
    } catch (err: any) {
      setError('Erreur lors du renvoi du code. Veuillez réessayer.')
    } finally {
      setResending(false)
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
          <div className="mb-6">
            <div className="flex justify-center mb-4">
              <img
                src="/images/logo.svg"
                alt="PronoHub"
                className="h-20 w-auto"
              />
            </div>
            <h1 className="text-2xl font-bold text-center text-white mb-2">
              Vérification de votre email
            </h1>
            <p className="text-sm text-center text-gray-400">
              Un code à 6 chiffres a été envoyé à<br />
              <span className="font-semibold text-[#ff9900]">{email}</span>
            </p>
          </div>

          {error && (
            <div className={`mb-4 p-3 border rounded-lg ${
              error.includes('succès')
                ? 'bg-green-900/50 border-green-600/50 text-green-200'
                : 'bg-red-900/50 border-red-600/50 text-red-200'
            }`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-[#2f2f2f] rounded-lg bg-[#1a1a1a] text-white focus:outline-none focus:border-[#ff9900] focus:shadow-[0_0_8px_rgba(255,153,0,0.3)] transition-all duration-[250ms]"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || code.some(d => !d)}
              className="w-full bg-[#ff9900] text-[#111] border-none rounded-lg py-3 font-semibold text-base cursor-pointer transition-all duration-[250ms] shadow-[0_0_14px_rgba(255,153,0,0.25)] hover:bg-[#e68a00] hover:shadow-[0_0_18px_rgba(255,153,0,0.4)] hover:-translate-y-px disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? 'Vérification...' : 'Valider'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#888] mb-2">
              Vous n'avez pas reçu le code ?
            </p>
            <button
              onClick={handleResendCode}
              disabled={resending}
              className="text-[#ffb84d] hover:text-[#ff9900] hover:underline text-sm font-medium transition-colors duration-200 disabled:text-gray-500"
            >
              {resending ? 'Envoi en cours...' : 'Renvoyer le code'}
            </button>
          </div>

          <p className="text-center mt-6 text-sm text-[#888] flex items-center justify-center gap-1">
            Retour à
            <img
              src="/images/logo.svg"
              alt="PronoHub"
              className="h-4 w-auto inline-block"
            />
            ?{' '}
            <a href="/auth/signup" className="text-[#ffb84d] hover:text-[#ff9900] hover:underline transition-colors duration-200">
              S'inscrire
            </a>
          </p>
        </div>
      </div>
      <Footer variant="minimal" />
    </div>
  )
}
