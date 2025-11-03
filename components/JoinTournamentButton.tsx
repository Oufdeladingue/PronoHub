'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinTournamentButton() {
  const [isInputMode, setIsInputMode] = useState(false)
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase()
    // Limiter à 8 caractères et seulement lettres/chiffres
    if (value.length <= 8 && /^[A-Z0-9]*$/.test(value)) {
      setCode(value)
      setError('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (code.length !== 8) {
      setError('Le code doit contenir 8 caractères')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Erreur lors de la tentative de rejoindre le tournoi')
        setIsLoading(false)
        return
      }

      // Rediriger vers la page d'échauffement du tournoi
      if (data.tournament) {
        const tournamentSlug = `${data.tournament.name.toLowerCase().replace(/\s+/g, '-')}_${data.tournament.slug || data.tournament.invite_code}`
        router.push(`/vestiaire/${tournamentSlug}/echauffement`)
      }
    } catch (err) {
      setError('Erreur de connexion au serveur')
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setIsInputMode(false)
    setCode('')
    setError('')
  }

  if (isInputMode) {
    return (
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="CODE8CAR"
            autoFocus
            className="w-full py-2 px-4 border-2 border-blue-600 rounded-md text-center font-mono text-lg tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            disabled={isLoading}
          />
          <div className="text-xs text-gray-500 text-center mt-1">
            {code.length}/8 caractères
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || code.length !== 8}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Vérification...' : 'Rejoindre'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isLoading}
            className="py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition disabled:bg-gray-100"
          >
            Annuler
          </button>
        </div>
      </form>
    )
  }

  return (
    <button
      onClick={() => setIsInputMode(true)}
      className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
    >
      Entrer un code
    </button>
  )
}
