'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area_name: string
  current_matchday: number
  remaining_matchdays: number
  remaining_matches: number
}

export default function TableauNoirPage() {
  const params = useParams()
  const router = useRouter()
  const competitionId = params.competitionId as string

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [freeTierMaxPlayers, setFreeTierMaxPlayers] = useState(10)

  // Réglages du tournoi
  const [tournamentName, setTournamentName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [numMatchdays, setNumMatchdays] = useState(1)
  const [allMatchdays, setAllMatchdays] = useState(false)
  const [bonusMatchEnabled, setBonusMatchEnabled] = useState(false)
  const [tournamentSlug, setTournamentSlug] = useState('')

  // Générer un slug unique au chargement
  useEffect(() => {
    generateSlug()
  }, [])

  useEffect(() => {
    fetchCompetitionDetails()
    fetchPublicSettings()
  }, [competitionId])

  const fetchCompetitionDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/competitions/active')
      if (!response.ok) throw new Error('Erreur lors du chargement de la compétition')

      const data = await response.json()
      const comp = data.competitions.find((c: Competition) => c.id === parseInt(competitionId))

      if (!comp) throw new Error('Compétition non trouvée')

      setCompetition(comp)
      // Initialiser le nombre de journées au maximum disponible
      setNumMatchdays(comp.remaining_matchdays || 1)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPublicSettings = async () => {
    try {
      const response = await fetch('/api/settings/public')
      if (!response.ok) return // Utiliser la valeur par défaut si erreur

      const data = await response.json()
      if (data.success && data.settings.free_tier_max_players) {
        setFreeTierMaxPlayers(parseInt(data.settings.free_tier_max_players))
      }
    } catch (err: any) {
      console.error('Error fetching public settings:', err)
      // Utiliser la valeur par défaut en cas d'erreur
    }
  }

  const generateSlug = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let slug = ''
    for (let i = 0; i < 8; i++) {
      slug += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    setTournamentSlug(slug)
  }

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      alert('Veuillez entrer un nom de tournoi')
      return
    }

    if (!competition) {
      alert('Compétition non trouvée')
      return
    }

    try {
      const response = await fetch('/api/tournaments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tournamentName,
          slug: tournamentSlug,
          competitionId: competition.id,
          competitionName: competition.name,
          maxPlayers,
          numMatchdays: allMatchdays ? competition.remaining_matchdays : numMatchdays,
          allMatchdays,
          bonusMatchEnabled
        })
      })

      const data = await response.json()

      if (!data.success) {
        alert('Erreur: ' + (data.error || 'Erreur lors de la création du tournoi'))
        return
      }

      // Rediriger vers la page d'échauffement
      const slug = `${tournamentName.toLowerCase().replace(/\s+/g, '_')}_${tournamentSlug}`
      router.push(`/vestiaire/${slug}/echauffement`)
    } catch (error) {
      console.error('Error creating tournament:', error)
      alert('Erreur lors de la création du tournoi')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              PronoHub
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-gray-500">Chargement...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !competition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              PronoHub
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
            <strong>Erreur :</strong> {error || 'Compétition non trouvée'}
          </div>
          <Link
            href="/vestiaire"
            className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Retour au vestiaire
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
            PronoHub
          </Link>
          <Link
            href="/vestiaire"
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
          >
            Retour
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* En-tête avec logo de la compétition */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Le Tableau Noir</h1>
          <div className="flex items-center justify-center gap-4 mb-4">
            {competition.emblem && (
              <img
                src={competition.emblem}
                alt={competition.name}
                className="w-16 h-16 object-contain"
              />
            )}
            <div className="text-left">
              <h2 className="text-2xl font-bold text-gray-800">{competition.name}</h2>
              <p className="text-sm text-gray-600">
                {competition.remaining_matchdays} journée{competition.remaining_matchdays > 1 ? 's' : ''} restante{competition.remaining_matchdays > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <p className="text-lg text-gray-600">
            Configurez les paramètres de votre tournoi
          </p>
        </div>

        {/* Formulaire de configuration */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Nom du tournoi */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              Nom du tournoi
            </label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="Ex: Ligue des champions 2024"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
            />
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">
                Code du tournoi :
              </p>
              <div className="flex items-center gap-2">
                <code className="text-lg font-bold text-green-600 bg-white px-3 py-2 rounded border border-gray-300">
                  {tournamentSlug}
                </code>
                <button
                  type="button"
                  onClick={generateSlug}
                  className="px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition"
                  title="Générer un nouveau code"
                >
                  🔄
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ce code permettra à d'autres joueurs de rejoindre le tournoi
              </p>
            </div>
          </div>

          {/* Nombre de joueurs */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              Nombre de joueurs
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Version gratuite : maximum {freeTierMaxPlayers} joueurs
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setMaxPlayers(Math.max(2, maxPlayers - 1))}
                disabled={maxPlayers <= 2}
                className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-2xl font-bold text-gray-700 transition"
              >
                −
              </button>
              <input
                type="number"
                min="2"
                max={freeTierMaxPlayers}
                value={maxPlayers}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 2 && val <= freeTierMaxPlayers) {
                    setMaxPlayers(val)
                  }
                }}
                className="w-24 h-12 text-center text-2xl font-bold text-green-600 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={() => setMaxPlayers(Math.min(freeTierMaxPlayers, maxPlayers + 1))}
                disabled={maxPlayers >= freeTierMaxPlayers}
                className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-2xl font-bold text-gray-700 transition"
              >
                +
              </button>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              Min: 2 • Max: {freeTierMaxPlayers}
            </p>
          </div>

          {/* Nombre de journées */}
          <div className="mb-8">
            <label className="block text-lg font-semibold text-gray-900 mb-2">
              Nombre de journées
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Les journées qui se dérouleront avant que le tournoi soit complet ne seront pas prises en compte
            </p>
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={() => setNumMatchdays(Math.max(1, numMatchdays - 1))}
                disabled={numMatchdays <= 1 || allMatchdays}
                className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-2xl font-bold text-gray-700 transition"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                max={competition.remaining_matchdays}
                value={allMatchdays ? competition.remaining_matchdays : numMatchdays}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1 && val <= competition.remaining_matchdays) {
                    setNumMatchdays(val)
                  }
                }}
                disabled={allMatchdays}
                className="w-24 h-12 text-center text-2xl font-bold text-green-600 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              />
              <button
                onClick={() => setNumMatchdays(Math.min(competition.remaining_matchdays, numMatchdays + 1))}
                disabled={numMatchdays >= competition.remaining_matchdays || allMatchdays}
                className="w-12 h-12 flex items-center justify-center bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded-lg text-2xl font-bold text-gray-700 transition"
              >
                +
              </button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <input
                type="checkbox"
                id="allMatchdays"
                checked={allMatchdays}
                onChange={(e) => {
                  setAllMatchdays(e.target.checked)
                  if (e.target.checked) {
                    setNumMatchdays(competition.remaining_matchdays)
                  }
                }}
                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
              />
              <label htmlFor="allMatchdays" className="text-sm text-gray-700 cursor-pointer">
                Tous les matchs restants ({competition.remaining_matchdays} journées)
              </label>
            </div>
          </div>

          {/* Match bonus */}
          <div className="mb-8">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-1">
                  Match bonus
                </label>
                <p className="text-sm text-gray-600">
                  Active une fonctionnalité spéciale pour les matchs importants
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBonusMatchEnabled(!bonusMatchEnabled)}
                style={{
                  width: '80px',
                  height: '40px',
                  backgroundColor: bonusMatchEnabled ? '#22c55e' : '#d1d5db',
                  borderRadius: '9999px',
                  position: 'relative',
                  transition: 'background-color 0.3s',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '4px',
                    left: bonusMatchEnabled ? '44px' : '4px',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </button>
            </div>
          </div>

          {/* Bouton inviter des amis */}
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700 text-center">
              Une rencontre ne se joue jamais seul ! Pas d'inquiètude, vous pourrez inviter vos amis à la prochaine étape
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <Link
              href="/vestiaire"
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-center"
            >
              Annuler
            </Link>
            <button
              onClick={handleCreateTournament}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
            >
              Créer le tournoi
            </button>
          </div>
        </div>

        {/* Informations supplémentaires */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note :</strong> Les journées de compétition qui auront lieu avant que votre tournoi
            atteigne le nombre de joueurs requis ne seront pas comptabilisées. Assurez-vous d'inviter
            rapidement vos amis pour ne pas manquer de journées !
          </p>
        </div>
      </main>
    </div>
  )
}
