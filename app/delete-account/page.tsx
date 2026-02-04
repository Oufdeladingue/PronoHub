'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'
import { useState } from 'react'

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Veuillez saisir votre adresse email')
      return
    }

    // TODO: Implémenter l'envoi de la demande (email ou API)
    // Pour l'instant, on simule juste la soumission
    console.log('Demande de suppression:', { email, reason })

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="mb-12">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-8"
              >
                <ArrowLeft className="w-4 h-4" />
                Retour à l'accueil
              </Link>
            </div>

            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-4">Demande envoyée</h1>
              <p className="text-gray-300 mb-6">
                Votre demande de suppression de compte a été enregistrée.
                Nous la traiterons dans les plus brefs délais (généralement sous 48h).
              </p>
              <p className="text-sm text-gray-400">
                Vous recevrez un email de confirmation à <strong className="text-white">{email}</strong>
              </p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Suppression de compte
            </h1>
            <p className="text-gray-400">
              Demandez la suppression définitive de votre compte et de vos données
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 md:p-8 mb-8">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-6">
              <h2 className="text-lg font-semibold text-orange-400 mb-2">⚠️ Attention</h2>
              <p className="text-gray-300 text-sm">
                La suppression de votre compte est <strong className="text-white">définitive et irréversible</strong>.
                Toutes vos données seront supprimées, y compris :
              </p>
              <ul className="list-disc list-inside text-gray-300 text-sm mt-2 space-y-1 ml-4">
                <li>Votre profil et informations personnelles</li>
                <li>Vos pronostics et statistiques</li>
                <li>Votre historique de participation aux tournois</li>
                <li>Vos trophées et badges</li>
              </ul>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Adresse email du compte à supprimer <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.email@exemple.com"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#ff9900] transition"
                  required
                />
              </div>

              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">
                  Raison de la suppression (optionnel)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Dites-nous pourquoi vous souhaitez supprimer votre compte..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#ff9900] transition resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Vos retours nous aident à améliorer PronoHub
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                Demander la suppression de mon compte
              </button>
            </form>
          </div>

          <div className="text-center text-sm text-gray-400">
            <p>
              Des questions ? Contactez-nous à{' '}
              <a href="mailto:contact@pronohub.club" className="text-[#ff9900] hover:underline">
                contact@pronohub.club
              </a>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
