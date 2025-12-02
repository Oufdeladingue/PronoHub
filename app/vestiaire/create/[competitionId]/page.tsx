'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Crown, Sparkles, Trophy, Users, Award, Zap, Check, Lock } from 'lucide-react'
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

// Interface pour les limites de pricing
interface PricingLimits {
  freeMaxPlayers: number
  freeMaxMatchdays: number
  oneshotMaxPlayers: number
  eliteMaxPlayers: number
  platiniumMinPlayers: number
  platiniumMaxPlayers: number
}

export default function TableauNoirPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const competitionId = params.competitionId as string
  const supabase = createClient()
  const { username, userAvatar } = useUser()

  // Type de tournoi force depuis l'URL (apres paiement)
  const forcedType = searchParams.get('type') as 'oneshot' | 'elite' | 'platinium' | null

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Limites dynamiques depuis pricing_config
  const [pricingLimits, setPricingLimits] = useState<PricingLimits>({
    freeMaxPlayers: 5,
    freeMaxMatchdays: 10,
    oneshotMaxPlayers: 10,
    eliteMaxPlayers: 20,
    platiniumMinPlayers: 11,
    platiniumMaxPlayers: 30
  })

  // Type de tournoi qui sera cree (base sur les quotas utilisateur)
  const [tournamentTypeInfo, setTournamentTypeInfo] = useState<TournamentTypeResult | null>(null)
  const [maxPlayersLimit, setMaxPlayersLimit] = useState(5) // Limite par defaut (free = 5)
  const [minPlayersLimit, setMinPlayersLimit] = useState(2) // Minimum par defaut

  // Credits disponibles
  const [credits, setCredits] = useState({
    oneshot_credits: 0,
    elite_credits: 0,
    platinium_solo_credits: 0,
    platinium_group_slots: 0
  })
  const [selectedTournamentType, setSelectedTournamentType] = useState<'free' | 'oneshot' | 'elite' | 'platinium'>('free')

  // Reglages du tournoi
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
    fetchCredits()
    fetchPricingLimits()
  }, [competitionId])

  // Charger les limites de prix depuis l'API
  const fetchPricingLimits = async () => {
    try {
      const response = await fetch('/api/pricing/config')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.prices) {
          setPricingLimits({
            freeMaxPlayers: data.prices.freeMaxPlayers || 5,
            freeMaxMatchdays: data.prices.freeMaxMatchdays || 10,
            oneshotMaxPlayers: data.prices.oneshotMaxPlayers || 10,
            eliteMaxPlayers: data.prices.eliteMaxPlayers || 20,
            platiniumMinPlayers: data.prices.platiniumMinPlayers || 11,
            platiniumMaxPlayers: data.prices.platiniumMaxPlayers || 30
          })
        }
      }
    } catch (err) {
      console.error('Error fetching pricing limits:', err)
    }
  }

  // Recuperer les credits disponibles
  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/user/credits')
      if (response.ok) {
        const data = await response.json()
        setCredits(data)

        // Si un type est force depuis l'URL (apres paiement), l'utiliser en priorite
        if (forcedType) {
          setSelectedTournamentType(forcedType)
          return // Les limites seront mises a jour par le useEffect
        }

        // Sinon, si l'utilisateur a des credits, pre-selectionner le type correspondant
        if (data.elite_credits > 0) {
          setSelectedTournamentType('elite')
        } else if (data.oneshot_credits > 0) {
          setSelectedTournamentType('oneshot')
        } else if (data.platinium_group_slots > 0 || data.platinium_solo_credits > 0) {
          setSelectedTournamentType('platinium')
        }
      }
    } catch (err) {
      console.error('Error fetching credits:', err)
    }
  }

  // Mettre a jour les limites de joueurs selon le type selectionne (avec valeurs dynamiques)
  useEffect(() => {
    let newMaxLimit: number
    let newMinLimit = 2 // Par defaut

    switch (selectedTournamentType) {
      case 'free':
        newMaxLimit = pricingLimits.freeMaxPlayers
        break
      case 'oneshot':
        newMaxLimit = pricingLimits.oneshotMaxPlayers
        break
      case 'elite':
        newMaxLimit = pricingLimits.eliteMaxPlayers
        break
      case 'platinium':
        newMaxLimit = pricingLimits.platiniumMaxPlayers
        newMinLimit = pricingLimits.platiniumMinPlayers
        break
      default:
        newMaxLimit = pricingLimits.freeMaxPlayers
    }

    setMaxPlayersLimit(newMaxLimit)
    setMinPlayersLimit(newMinLimit)

    // Ajuster maxPlayers si hors limites
    if (maxPlayers > newMaxLimit) {
      setMaxPlayers(newMaxLimit)
    }
    if (maxPlayers < newMinLimit) {
      setMaxPlayers(newMinLimit)
    }
  }, [selectedTournamentType, pricingLimits])

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

  // Verifier si l'utilisateur a un credit pour le type selectionne
  const hasCredit = (type: string) => {
    switch (type) {
      case 'oneshot': return credits.oneshot_credits > 0
      case 'elite': return credits.elite_credits > 0
      case 'platinium': return credits.platinium_solo_credits > 0 || credits.platinium_group_slots > 0
      default: return true // free
    }
  }

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      alert('Veuillez entrer un nom de tournoi')
      return
    }

    if (!competition) {
      alert('Competition non trouvee')
      return
    }

    // Verifier les credits pour les tournois payants
    if (selectedTournamentType !== 'free' && !hasCredit(selectedTournamentType)) {
      alert(`Vous n'avez pas de credit ${selectedTournamentType}. Achetez-en un sur la page Pricing.`)
      router.push('/pricing')
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
          drawWithDefaultPredictionPoints,
          tournamentType: selectedTournamentType,
          use_credit: selectedTournamentType !== 'free'
        })
      })

      const data = await response.json()

      if (!data.success) {
        if (data.requiresPayment) {
          alert(`Ce type de tournoi necessite un credit. Achetez-en un sur la page Pricing.`)
          router.push('/pricing')
          return
        }
        alert('Erreur: ' + (data.error || 'Erreur lors de la creation du tournoi'))
        return
      }

      // Rediriger vers la page d'echauffement
      const slug = `${tournamentName.toLowerCase().replace(/\s+/g, '_')}_${tournamentSlug}`
      router.push(`/vestiaire/${slug}/echauffement`)
    } catch (error) {
      console.error('Error creating tournament:', error)
      alert('Erreur lors de la creation du tournoi')
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
          {/* Selection du type de tournoi */}
          <div className="mb-8">
            <label className="block text-lg font-semibold theme-text mb-4 text-center">
              Type de tournoi
            </label>

            {/* Message si type force depuis le paiement */}
            {forcedType && (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-400">
                  Type de tournoi pre-selectionne suite a votre achat
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Free - toujours verrouille si un type payant est force */}
              <button
                type="button"
                onClick={() => !forcedType && setSelectedTournamentType('free')}
                disabled={!!forcedType}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  selectedTournamentType === 'free'
                    ? 'border-blue-500 bg-blue-500/10'
                    : forcedType ? 'border-gray-700 opacity-40 cursor-not-allowed' : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                {forcedType && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedTournamentType === 'free' ? 'bg-blue-500/20' : 'bg-gray-700'
                  }`}>
                    <Zap className={`w-5 h-5 ${selectedTournamentType === 'free' ? 'text-blue-500' : 'text-gray-400'}`} />
                  </div>
                  <span className={`font-medium ${selectedTournamentType === 'free' ? 'text-blue-400' : 'text-gray-300'}`}>
                    Free-Kick
                  </span>
                  <span className="text-xs text-gray-500">Max {pricingLimits.freeMaxPlayers} joueurs</span>
                  <span className="text-xs text-green-400">Gratuit</span>
                </div>
              </button>

              {/* One-Shot */}
              <button
                type="button"
                onClick={() => !forcedType && credits.oneshot_credits > 0 && setSelectedTournamentType('oneshot')}
                disabled={(!!forcedType && forcedType !== 'oneshot') || (!forcedType && credits.oneshot_credits === 0)}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  selectedTournamentType === 'oneshot'
                    ? 'border-green-500 bg-green-500/10'
                    : forcedType && forcedType !== 'oneshot'
                      ? 'border-gray-700 opacity-40 cursor-not-allowed'
                      : credits.oneshot_credits > 0 || forcedType === 'oneshot'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                {forcedType && forcedType !== 'oneshot' && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedTournamentType === 'oneshot' ? 'bg-green-500/20' : 'bg-gray-700'
                  }`}>
                    <Trophy className={`w-5 h-5 ${selectedTournamentType === 'oneshot' ? 'text-green-500' : 'text-gray-400'}`} />
                  </div>
                  <span className={`font-medium ${selectedTournamentType === 'oneshot' ? 'text-green-400' : 'text-gray-300'}`}>
                    One-Shot
                  </span>
                  <span className="text-xs text-gray-500">Max {pricingLimits.oneshotMaxPlayers} joueurs</span>
                  {credits.oneshot_credits > 0 || forcedType === 'oneshot' ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {forcedType === 'oneshot' ? '1' : credits.oneshot_credits} credit(s)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun credit</span>
                  )}
                </div>
              </button>

              {/* Elite */}
              <button
                type="button"
                onClick={() => !forcedType && credits.elite_credits > 0 && setSelectedTournamentType('elite')}
                disabled={(!!forcedType && forcedType !== 'elite') || (!forcedType && credits.elite_credits === 0)}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  selectedTournamentType === 'elite'
                    ? 'border-orange-500 bg-orange-500/10'
                    : forcedType && forcedType !== 'elite'
                      ? 'border-gray-700 opacity-40 cursor-not-allowed'
                      : credits.elite_credits > 0 || forcedType === 'elite'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                {forcedType && forcedType !== 'elite' && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedTournamentType === 'elite' ? 'bg-orange-500/20' : 'bg-gray-700'
                  }`}>
                    <Users className={`w-5 h-5 ${selectedTournamentType === 'elite' ? 'text-orange-500' : 'text-gray-400'}`} />
                  </div>
                  <span className={`font-medium ${selectedTournamentType === 'elite' ? 'text-orange-400' : 'text-gray-300'}`}>
                    Elite Team
                  </span>
                  <span className="text-xs text-gray-500">Max {pricingLimits.eliteMaxPlayers} joueurs</span>
                  {credits.elite_credits > 0 || forcedType === 'elite' ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {forcedType === 'elite' ? '1' : credits.elite_credits} credit(s)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun credit</span>
                  )}
                </div>
              </button>

              {/* Platinium */}
              <button
                type="button"
                onClick={() => !forcedType && (credits.platinium_solo_credits > 0 || credits.platinium_group_slots > 0) && setSelectedTournamentType('platinium')}
                disabled={(!!forcedType && forcedType !== 'platinium') || (!forcedType && credits.platinium_solo_credits === 0 && credits.platinium_group_slots === 0)}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  selectedTournamentType === 'platinium'
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : forcedType && forcedType !== 'platinium'
                      ? 'border-gray-700 opacity-40 cursor-not-allowed'
                      : (credits.platinium_solo_credits > 0 || credits.platinium_group_slots > 0) || forcedType === 'platinium'
                        ? 'border-gray-600 hover:border-gray-500'
                        : 'border-gray-700 opacity-50 cursor-not-allowed'
                }`}
              >
                {forcedType && forcedType !== 'platinium' && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-gray-500" />
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    selectedTournamentType === 'platinium' ? 'bg-yellow-500/20' : 'bg-gray-700'
                  }`}>
                    <Award className={`w-5 h-5 ${selectedTournamentType === 'platinium' ? 'text-yellow-500' : 'text-gray-400'}`} />
                  </div>
                  <span className={`font-medium ${selectedTournamentType === 'platinium' ? 'text-yellow-400' : 'text-gray-300'}`}>
                    Platinium
                  </span>
                  <span className="text-xs text-gray-500">{pricingLimits.platiniumMinPlayers}-{pricingLimits.platiniumMaxPlayers} joueurs</span>
                  {(credits.platinium_solo_credits > 0 || credits.platinium_group_slots > 0) || forcedType === 'platinium' ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {forcedType === 'platinium' ? '1+' : (credits.platinium_group_slots || credits.platinium_solo_credits)} place(s)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun credit</span>
                  )}
                </div>
              </button>
            </div>

            {/* Lien vers pricing si pas de credits et pas de type force */}
            {!forcedType && (credits.oneshot_credits === 0 && credits.elite_credits === 0 && credits.platinium_solo_credits === 0 && credits.platinium_group_slots === 0) && (
              <div className="mt-4 text-center">
                <Link href="/pricing" className="text-sm text-orange-400 hover:text-orange-300 underline">
                  Acheter des credits pour debloquer plus d'options
                </Link>
              </div>
            )}
          </div>

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
              className="theme-input theme-dark-bg border-2 creation-input"
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
                {selectedTournamentType === 'platinium' && 'Tournoi Platinium : '}
                {selectedTournamentType === 'elite' && 'Tournoi Elite Team : '}
                {selectedTournamentType === 'oneshot' && 'Tournoi One-Shot : '}
                {selectedTournamentType === 'free' && 'Version Free-Kick : '}
                {minPlayersLimit === maxPlayersLimit
                  ? `${maxPlayersLimit} joueurs`
                  : `${minPlayersLimit} - ${maxPlayersLimit} joueurs`
                }
              </p>
              <div className="flex items-start justify-center gap-3">
                <button
                  onClick={() => setMaxPlayers(Math.max(minPlayersLimit, maxPlayers - 1))}
                  disabled={maxPlayers <= minPlayersLimit}
                  className="btn-counter"
                >
                  −
                </button>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min={minPlayersLimit}
                    max={maxPlayersLimit}
                    value={maxPlayers}
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val >= minPlayersLimit && val <= maxPlayersLimit) {
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
                Min: {minPlayersLimit} | Max: {maxPlayersLimit}
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

