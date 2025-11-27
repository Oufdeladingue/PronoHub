'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, Sparkles } from 'lucide-react'
import { TournamentTypeResult } from '@/types/monetization'
import { TournamentTypeIndicator } from '@/components/UpgradeBanner'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'

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
  const supabase = createClient()
  const { username, userAvatar } = useUser()

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Type de tournoi qui sera créé (basé sur les quotas utilisateur)
  const [tournamentTypeInfo, setTournamentTypeInfo] = useState<TournamentTypeResult | null>(null)
  const [maxPlayersLimit, setMaxPlayersLimit] = useState(8) // Limite par défaut

  // Réglages du tournoi
  const [tournamentName, setTournamentName] = useState('')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [numMatchdays, setNumMatchdays] = useState(1)
  const [allMatchdays, setAllMatchdays] = useState(false)
  const [bonusMatchEnabled, setBonusMatchEnabled] = useState(false)
  const [earlyPredictionBonus, setEarlyPredictionBonus] = useState(false)
  const [tournamentSlug, setTournamentSlug] = useState('')
  const [drawWithDefaultPredictionPoints, setDrawWithDefaultPredictionPoints] = useState(1)

  // Générer un slug unique au chargement
  useEffect(() => {
    generateSlug()
  }, [])

  useEffect(() => {
    fetchCompetitionDetails()
    fetchTournamentTypeInfo()
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

  // Récupérer le type de tournoi et la limite de joueurs basée sur les quotas utilisateur
  const fetchTournamentTypeInfo = async () => {
    try {
      const response = await fetch('/api/user/quotas', { method: 'POST' })
      if (!response.ok) return

      const data = await response.json()
      if (data.success && data.result) {
        setTournamentTypeInfo(data.result)
        // Définir la limite max de joueurs selon le type de tournoi
        if (data.result.max_players) {
          setMaxPlayersLimit(data.result.max_players)
        }
      }
    } catch (err: any) {
      console.error('Error fetching tournament type info:', err)
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
          bonusMatchEnabled,
          earlyPredictionBonus,
          drawWithDefaultPredictionPoints
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
      <div className="min-h-screen">
        <Navigation
          context="app"
          username={username || 'Utilisateur'}
          userAvatar={userAvatar || 'avatar1'}
        />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="theme-text-secondary">Chargement...</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !competition) {
    return (
      <div className="min-h-screen">
        <Navigation
          context="app"
          username={username || 'Utilisateur'}
          userAvatar={userAvatar || 'avatar1'}
        />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="theme-secondary-bg border theme-border rounded-lg p-4 theme-text mb-6">
            <strong className="theme-accent-text-always">Erreur :</strong> {error || 'Compétition non trouvée'}
          </div>
          <Link
            href="/vestiaire"
            className="inline-block px-4 py-2 theme-secondary-bg theme-text rounded-lg hover:opacity-80"
          >
            Retour au vestiaire
          </Link>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navigation
        context="creation"
        username={username || 'Utilisateur'}
        userAvatar={userAvatar || 'avatar1'}
        creationContext={{
          competitionName: competition.name,
          competitionLogo: competition.emblem,
          remainingMatchdays: competition.remaining_matchdays
        }}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold theme-text mb-2">Le Tableau Noir</h1>
          <p className="text-lg theme-text-secondary">
            Configurez les paramètres de votre tournoi
          </p>
        </div>

        {/* Formulaire de configuration */}
        <div className="theme-card shadow-lg p-8">
          {/* Indicateur du type de tournoi */}
          <TournamentTypeIndicator />
          {/* Nom du tournoi */}
          <div className="mb-8">
            <label className="block text-lg font-semibold theme-text mb-2">
              Nom du tournoi
            </label>
            <input
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value)}
              placeholder="Ex: Ligue des champions 2024"
              className="theme-input theme-dark-bg border-2"
            />
          </div>

          {/* Nombre de joueurs et journées - Sur la même ligne */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nombre de joueurs */}
            <div>
              <label className="block text-lg font-semibold theme-text mb-2 text-center">
                Nombre de joueurs
              </label>
              <p className="text-sm theme-text-secondary mb-4 text-center">
                {tournamentTypeInfo?.tournament_type === 'premium' && 'Tournoi Premium : '}
                {tournamentTypeInfo?.tournament_type === 'oneshot' && 'Tournoi One-Shot : '}
                {tournamentTypeInfo?.tournament_type === 'free' && 'Version gratuite : '}
                {!tournamentTypeInfo?.tournament_type && 'Version gratuite : '}
                max {maxPlayersLimit}
              </p>
              <div className="flex items-start justify-center gap-3">
                <button
                  onClick={() => setMaxPlayers(Math.max(2, maxPlayers - 1))}
                  disabled={maxPlayers <= 2}
                  className="btn-counter"
                >
                  −
                </button>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="2"
                    max={maxPlayersLimit}
                    value={maxPlayers}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val >= 2 && val <= maxPlayersLimit) {
                        setMaxPlayers(val)
                      }
                    }}
                    className="w-16 h-10 text-center text-xl font-bold theme-accent-text-always border-2 theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 theme-input"
                  />
                  <span className="text-xs theme-text-secondary mt-1">participants</span>
                </div>
                <button
                  onClick={() => setMaxPlayers(Math.min(maxPlayersLimit, maxPlayers + 1))}
                  disabled={maxPlayers >= maxPlayersLimit}
                  className="btn-counter"
                >
                  +
                </button>
              </div>
              <p className="text-center text-sm theme-text-secondary mt-2">
                Min: 2 | Max: {maxPlayersLimit}
              </p>
            </div>

            {/* Nombre de journées */}
            <div>
              <label className="block text-lg font-semibold theme-text mb-2 text-center">
                Nombre de journées
              </label>
              <p className="text-sm theme-text-secondary mb-4 text-center">
                Le tournoi se déroulera sur :
              </p>
              <div className="flex items-start justify-center gap-3 mb-3">
                <button
                  onClick={() => setNumMatchdays(Math.max(1, numMatchdays - 1))}
                  disabled={numMatchdays <= 1 || allMatchdays}
                  className="btn-counter"
                >
                  −
                </button>
                <div className="flex flex-col items-center">
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
                    className="w-16 h-10 text-center text-xl font-bold theme-accent-text-always border-2 theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 theme-input disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs theme-text-secondary mt-1">journées</span>
                </div>
                <button
                  onClick={() => setNumMatchdays(Math.min(competition.remaining_matchdays, numMatchdays + 1))}
                  disabled={numMatchdays >= competition.remaining_matchdays || allMatchdays}
                  className="btn-counter"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-center gap-2">
                <label className="text-sm theme-text">
                  Tous restants ({competition.remaining_matchdays})
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setAllMatchdays(!allMatchdays)
                    if (!allMatchdays) {
                      setNumMatchdays(competition.remaining_matchdays)
                    }
                  }}
                  className={`toggle-switch ${allMatchdays ? 'active' : ''}`}
                >
                  <span className="toggle-switch-knob" />
                </button>
              </div>
            </div>
          </div>

          {/* Match bonus, Prime d'avant-match et Points pour match nul - Sur la même ligne */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Match bonus */}
            <div className="p-4 theme-dark-bg rounded-lg flex flex-col">
              <label className="block text-lg font-semibold theme-text mb-3 text-center">
                Match bonus
              </label>
              <p className="text-sm theme-text-secondary mb-4 text-center flex-1">
                Chaque journée, un match est choisi aléatoirement et rapporte le double de points pour tous les participants.
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setBonusMatchEnabled(!bonusMatchEnabled)}
                  className={`toggle-switch-lg ${bonusMatchEnabled ? 'active' : ''}`}
                >
                  <span className="toggle-switch-knob-lg" />
                </button>
              </div>
            </div>

            {/* Prime d'avant-match */}
            <div className="p-4 theme-dark-bg rounded-lg flex flex-col">
              <label className="block text-lg font-semibold theme-text mb-3 text-center">
                Prime d'avant-match
              </label>
              <p className="text-sm theme-text-secondary mb-4 text-center flex-1">
                1 point supplémentaire si tous les pronos sont renseignés avant le début du premier match<br />(aide à lutter contre les forfaits)
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setEarlyPredictionBonus(!earlyPredictionBonus)}
                  className={`toggle-switch-lg ${earlyPredictionBonus ? 'active' : ''}`}
                >
                  <span className="toggle-switch-knob-lg" />
                </button>
              </div>
            </div>

            {/* Points pour match nul avec prono par défaut */}
            <div className="p-4 theme-dark-bg rounded-lg">
              <label className="block text-lg font-semibold theme-text mb-1 text-center">
                Score vierge
              </label>
              <p className="text-sm theme-text-secondary mb-3 text-center">
                En cas d'oubli et d'absence de pronostic, le 0-0 peut rapporter au mieux :
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDrawWithDefaultPredictionPoints(Math.max(0, drawWithDefaultPredictionPoints - 1))}
                  disabled={drawWithDefaultPredictionPoints <= 0}
                  className="w-10 h-10 flex items-center justify-center theme-secondary-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xl font-bold theme-text transition"
                >
                  −
                </button>
                <input
                  type="number"
                  min="0"
                  max="3"
                  value={drawWithDefaultPredictionPoints}
                  onChange={(e) => {
                    const val = parseInt(e.target.value)
                    if (!isNaN(val) && val >= 0 && val <= 3) {
                      setDrawWithDefaultPredictionPoints(val)
                    }
                  }}
                  className="w-16 h-10 text-center text-xl font-bold theme-accent-text-always border-2 theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 theme-input"
                />
                <button
                  onClick={() => setDrawWithDefaultPredictionPoints(Math.min(3, drawWithDefaultPredictionPoints + 1))}
                  disabled={drawWithDefaultPredictionPoints >= 3}
                  className="w-10 h-10 flex items-center justify-center theme-secondary-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xl font-bold theme-text transition"
                >
                  +
                </button>
              </div>
              <p className="text-center text-sm theme-text-secondary mt-2">
                Min: 0 | Max: 3 | Recommandé: 1
              </p>
            </div>
          </div>

          {/* Bouton inviter des amis */}
          <div className="mb-8 p-6 theme-secondary-bg theme-border border rounded-lg">
            <p className="text-sm theme-text text-center">
              Une rencontre ne se joue jamais seul ! Pas d'inquiètude, vous pourrez inviter vos amis à la prochaine étape
            </p>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <Link
              href="/vestiaire"
              className="flex-1 px-6 py-3 btn-cancel text-center font-semibold"
            >
              Annuler
            </Link>
            <button
              onClick={handleCreateTournament}
              className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition font-semibold"
            >
              Créer le tournoi
            </button>
          </div>
        </div>

        {/* Informations supplémentaires */}
        <div className="mt-6 p-4 theme-secondary-bg theme-border border rounded-lg">
          <p className="text-sm theme-text">
            <strong className="theme-accent-text-always">Note :</strong> Les journées de compétition qui auront lieu avant que votre tournoi
            atteigne le nombre de joueurs requis ne seront pas comptabilisées. Assurez-vous d'inviter
            rapidement vos amis pour ne pas manquer de journées !
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

