'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-2 border-gray-300">
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/images/logo.svg"
              alt="PronoHub"
              className="h-20 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            Vérification de votre email
          </h1>
          <p className="text-sm text-center text-gray-600">
            Un code à 6 chiffres a été envoyé à<br />
            <span className="font-semibold">{email}</span>
          </p>
        </div>

        {error && (
          <div className={`mb-4 p-3 border rounded ${
            error.includes('succès')
              ? 'bg-green-100 border-green-400 text-green-700'
              : 'bg-red-100 border-red-400 text-red-700'
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
                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || code.some(d => !d)}
            className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Vérification...' : 'Valider'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Vous n'avez pas reçu le code ?
          </p>
          <button
            onClick={handleResendCode}
            disabled={resending}
            className="text-green-600 hover:underline text-sm font-medium disabled:text-gray-400"
          >
            {resending ? 'Envoi en cours...' : 'Renvoyer le code'}
          </button>
        </div>

        <p className="text-center mt-6 text-sm text-gray-600 flex items-center justify-center gap-1">
          Retour à
          <img
            src="/images/logo.svg"
            alt="PronoHub"
            className="h-4 w-auto inline-block"
          />
          ?{' '}
          <a href="/auth/signup" className="text-green-600 hover:underline">
            S'inscrire
          </a>
        </p>
      </div>
    </div>
  )
}
