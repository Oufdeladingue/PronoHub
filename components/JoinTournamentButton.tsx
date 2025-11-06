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
      className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-[#ff9900] text-[#111] rounded-md hover:bg-[#e68a00] transition font-semibold"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 419.5 375.3" className="w-5 h-5" fill="currentColor">
        <path d="M417.1,64.6c-1.7-10.4-8.3-15.8-18.9-15.9c-22.2,0-44.4,0-66.6,0c-1.5,0-3,0-5.1,0c0-2,0-3.9,0-5.7c0-6,0.1-12-0.1-18c-0.3-12.9-10.1-22.7-23-22.8c-15.1-0.1-30.2,0-45.3,0c-46,0-92,0-138,0c-15.8,0-24.9,8.5-25.6,24.3C94,33.8,94.3,41,94.3,48.8c-1.7,0-3.1,0-4.6,0c-22.2,0-44.4,0-66.6,0c-11.2,0-17.8,5.1-19.5,16.2c-8.4,56.5,7.9,104.9,49.1,144.5c23.4,22.4,51.7,36.9,82,47.5c9.7,3.4,19.7,6.2,29.6,9.1c15.5,4.6,24.4,18.4,22.3,34.8c-1.9,14.7-15.1,26.6-30.6,26.5c-12.9,0-23.8,3.7-31.8,14.3c-4.3,5.7-6.5,12.2-6.9,19.3c-0.4,7.7,4.5,13,12.3,13c53.2,0,106.5,0,159.7,0c7.2,0,11.6-4.5,11.7-11.8c0.3-18.8-15.1-34.1-34.5-34.8c-5.7-0.2-11.8-1-17-3.2c-12.1-5-19.1-17.8-18.1-30.7c1.1-13.1,9.8-24,22.6-27.4c24.4-6.6,48-14.8,70.2-27c39.8-21.8,69.2-52.7,85.3-95.6c5.1-13.7,8-27.9,8.9-42.6c0.1-1.3,0.4-2.6,0.7-4c0-4.9,0-9.8,0-14.7C418.7,76.4,418.1,70.5,417.1,64.6z M40.2,122.8c-3.3-12.7-4.5-25.6-3.6-39c1.6-0.1,2.9-0.2,4.2-0.2c16.5,0,32.9,0.1,49.4-0.1c3.5,0,4.8,0.8,5.2,4.6c4,39.9,12.7,78.6,31,114.6c3,5.8,6.3,11.4,10,18.1C89.9,201.2,53.5,173.3,40.2,122.8z M218.6,175.6c-4.7,4.7-9.1,9.7-14.3,13.8c-21.1,16.4-52.6,3.3-56.1-23.2c-1.5-11.3,1.7-21.2,9.6-29.3c7-7.2,14.1-14.3,21.3-21.3c6.7-6.5,14.9-9.6,24.1-9.7c9.6,0.1,17.8,3.4,24.6,9.9c2.9,2.8,3.2,6.9,0.6,9.6c-2.6,2.7-6.6,2.7-9.6-0.1c-9.3-8.6-22.4-8.4-31.4,0.5c-6.6,6.6-13.3,13.2-19.8,19.8c-6.2,6.3-8.2,13.9-5.6,22.4c2.6,8.4,8.6,13.5,17.2,15.1c7.4,1.4,13.9-0.8,19.3-6c3.5-3.3,6.8-6.8,10.3-10.2c3.6-3.5,9.5-2.1,10.9,2.6C220.5,171.7,220.2,173.9,218.6,175.6z M269.4,124.8c-6.9,7.2-14.1,14.2-21.2,21.2c-6.8,6.6-15,9.8-24.6,10c-9.2-0.1-17.4-3.4-24.3-9.9c-2.9-2.8-3.2-6.9-0.6-9.6c2.6-2.7,6.6-2.7,9.6,0c8.1,7.4,19.2,8.4,28,2.4c1.2-0.8,2.3-1.8,3.3-2.8c6.7-6.6,13.3-13.2,19.9-19.9c6.2-6.3,8.2-13.9,5.6-22.4c-2.6-8.4-8.5-13.5-17.2-15.2c-7.3-1.4-13.7,0.6-19.1,5.7c-3.6,3.4-7,7-10.5,10.4c-3.7,3.5-9.4,2.2-10.9-2.6c-0.7-2.1-0.5-4.4,1.1-5.9c5.1-5.1,9.8-10.6,15.6-14.8c21.3-15.3,51.4-1.9,54.9,24.1C280.3,106.9,277.2,116.7,269.4,124.8z M380.7,121.6c-7.2,30.8-24.7,54.7-49.6,73.5c-13.3,10-28,17.8-43.3,24.2c-0.8,0.4-1.7,0.6-2.6,0.9c4.7-9.1,9.6-17.9,13.8-26.9c13.5-29.1,20.8-60,25-91.7c0.7-5,1-10,1.8-15c0.2-1.1,1.8-2.8,2.7-2.8c18.1-0.2,36.2-0.1,54.3-0.1c0.4,0,0.8,0.2,1.5,0.4C384.7,96.7,383.6,109.3,380.7,121.6z"/>
      </svg>
      Rejoindre
    </button>
  )
}
