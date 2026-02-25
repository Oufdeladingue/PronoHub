'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Users, Award, Zap, Check, Lock, AlertTriangle, X, Info } from 'lucide-react'
import { TournamentTypeResult } from '@/types/monetization'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import { useUser } from '@/contexts/UserContext'
import { fetchWithAuth } from '@/lib/supabase/client'
import { trackTournamentCreated } from '@/lib/analytics'

interface Competition {
  id: number | string
  name: string
  code: string
  emblem: string | null
  custom_emblem_white?: string | null
  custom_emblem_color?: string | null
  area_name: string
  current_matchday: number
  remaining_matchdays: number
  remaining_matches: number
  is_custom?: boolean
  custom_competition_id?: string
  competition_type?: string
  matches_per_matchday?: number
  season?: string
  description?: string
  has_knockout_stages?: boolean
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
  const { username, userAvatar } = useUser()

  // Type de tournoi force depuis l'URL (apres paiement)
  const forcedType = searchParams.get('type') as 'oneshot' | 'elite' | 'platinium' | null
  // Nombre de slots prépayés depuis l'URL (pour Platinium)
  const slotsParam = searchParams.get('slots')
  const prepaidSlots = slotsParam ? parseInt(slotsParam, 10) : 1

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
  const [bonusQualifiedEnabled, setBonusQualifiedEnabled] = useState(false)

  // Modal d'erreur/alerte
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; type: 'error' | 'warning' | 'info' }>({
    show: false,
    title: '',
    message: '',
    type: 'error'
  })

  // Générer un slug unique au chargement
  useEffect(() => {
    generateSlug()
  }, [])

  // OPTIMISATION: Charger toutes les données en parallèle
  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Exécuter TOUS les appels API en parallèle (avec auth pour Capacitor)
        const [compResponse, quotasResponse, creditsResponse, pricingResponse] = await Promise.all([
          fetchWithAuth(`/api/competitions/${competitionId}`),
          fetchWithAuth('/api/user/quotas', { method: 'POST' }),
          fetchWithAuth('/api/user/credits'),
          fetchWithAuth('/api/pricing/config')
        ])

        // Traiter les résultats
        const [compData, quotasData, creditsData, pricingData] = await Promise.all([
          compResponse.json(),
          quotasResponse.ok ? quotasResponse.json() : null,
          creditsResponse.ok ? creditsResponse.json() : null,
          pricingResponse.ok ? pricingResponse.json() : null
        ])

        // 1. Compétition (requis)
        if (!compResponse.ok || !compData.success) {
          throw new Error(compData.error || 'Compétition non trouvée')
        }
        const comp = compData.competition
        setCompetition(comp)

        // 2. Pricing limits
        if (pricingData?.success && pricingData.prices) {
          setPricingLimits({
            freeMaxPlayers: pricingData.prices.freeMaxPlayers || 5,
            freeMaxMatchdays: pricingData.prices.freeMaxMatchdays || 10,
            oneshotMaxPlayers: pricingData.prices.oneshotMaxPlayers || 10,
            eliteMaxPlayers: pricingData.prices.eliteMaxPlayers || 20,
            platiniumMinPlayers: pricingData.prices.platiniumMinPlayers || 11,
            platiniumMaxPlayers: pricingData.prices.platiniumMaxPlayers || 30
          })
        }

        // 3. Quotas utilisateur
        if (quotasData?.success && quotasData.result) {
          setTournamentTypeInfo(quotasData.result)
          if (quotasData.result.max_players) {
            setMaxPlayersLimit(quotasData.result.max_players)
          }
        }

        // 4. Crédits utilisateur
        if (creditsData) {
          setCredits(creditsData)

          // Si un type est forcé depuis l'URL (après paiement), l'utiliser
          if (forcedType) {
            setSelectedTournamentType(forcedType)
          } else if (creditsData.elite_credits > 0) {
            setSelectedTournamentType('elite')
          } else if (creditsData.oneshot_credits > 0) {
            setSelectedTournamentType('oneshot')
          } else if (creditsData.platinium_group_slots > 0 || creditsData.platinium_solo_credits > 0) {
            setSelectedTournamentType('platinium')
          }
        }

        // Initialiser le nombre de journées (limité par la formule Free-Kick ou par la compétition)
        const freeMaxMatchdays = pricingData?.prices?.freeMaxMatchdays || 10
        const formulaLimit = selectedTournamentType === 'free' ? freeMaxMatchdays : Infinity
        const maxMatchdays = Math.min(formulaLimit, comp.remaining_matchdays || 1)
        setNumMatchdays(maxMatchdays)

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadAllData()
  }, [competitionId, forcedType])


  // Mettre a jour les limites de joueurs selon le type selectionne (avec valeurs dynamiques)
  useEffect(() => {
    let newMaxLimit: number
    let newMinLimit = 2 // Par defaut

    switch (selectedTournamentType) {
      case 'free':
        // Free-Kick est limité à 5 joueurs max (la limite peut être étendue à 10 via achat)
        newMaxLimit = Math.min(pricingLimits.freeMaxPlayers, 5)
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
        newMaxLimit = Math.min(pricingLimits.freeMaxPlayers, 5)
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

  // Mettre à jour le nombre de journées quand le type de tournoi change
  useEffect(() => {
    if (!competition) return

    // Limite de la formule (Free-Kick = 10, autres = illimité)
    const formulaLimit = selectedTournamentType === 'free' ? (pricingLimits.freeMaxMatchdays || 10) : Infinity
    // Max effectif = min entre la limite de formule et les journées restantes
    const maxMatchdaysForType = Math.min(formulaLimit, competition.remaining_matchdays)

    // Ajuster numMatchdays si hors limites
    if (numMatchdays > maxMatchdaysForType) {
      setNumMatchdays(maxMatchdaysForType)
    }
    // Ajuster allMatchdays si on passe à free et que la limite de formule s'applique
    if (allMatchdays && formulaLimit < competition.remaining_matchdays) {
      setNumMatchdays(maxMatchdaysForType)
    }
  }, [selectedTournamentType, pricingLimits, competition])

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

  // Fonction pour afficher la modal d'alerte
  const showAlert = (title: string, message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    setAlertModal({ show: true, title, message, type })
  }

  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, show: false }))
  }

  const handleCreateTournament = async () => {
    if (!tournamentName.trim()) {
      showAlert('Allez champion !', 'Veuillez entrer un nom de tournoi', 'warning')
      return
    }

    if (!competition) {
      showAlert('Erreur', 'Compétition non trouvée', 'error')
      return
    }

    // Verifier les credits pour les tournois payants
    // Si forcedType est défini, l'utilisateur a été redirigé depuis le dashboard avec des crédits
    const hasCreditForType = forcedType === selectedTournamentType || hasCredit(selectedTournamentType)
    if (selectedTournamentType !== 'free' && !hasCreditForType) {
      showAlert('Crédit requis', `Vous n'avez pas de crédit ${selectedTournamentType}. Achetez-en un sur la page Pricing.`, 'warning')
      setTimeout(() => router.push('/pricing'), 2000)
      return
    }

    try {
      // Préparer les données selon le type de compétition
      const tournamentData: any = {
        name: tournamentName,
        slug: tournamentSlug,
        competitionName: competition.name,
        maxPlayers,
        numMatchdays: allMatchdays ? competition.remaining_matchdays : numMatchdays,
        allMatchdays,
        bonusMatchEnabled,
        earlyPredictionBonus,
        drawWithDefaultPredictionPoints,
        bonusQualifiedEnabled,
        tournamentType: selectedTournamentType,
        use_credit: selectedTournamentType !== 'free',
        // Pour Platinium: nombre de places prépayées
        prepaidSlots: selectedTournamentType === 'platinium' ? prepaidSlots : undefined
      }

      // Pour les compétitions personnalisées, utiliser custom_competition_id
      if (competition.is_custom && competition.custom_competition_id) {
        tournamentData.customCompetitionId = competition.custom_competition_id
        tournamentData.isCustomCompetition = true
      } else {
        tournamentData.competitionId = competition.id
      }

      const response = await fetchWithAuth('/api/tournaments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tournamentData)
      })

      const data = await response.json()

      if (!data.success) {
        if (data.requiresPayment) {
          showAlert('Crédit requis', 'Ce type de tournoi nécessite un crédit. Achetez-en un sur la page Pricing.', 'warning')
          setTimeout(() => router.push('/pricing'), 2000)
          return
        }
        showAlert('Erreur', data.error || 'Erreur lors de la création du tournoi', 'error')
        return
      }

      // Rediriger vers la page d'echauffement
      trackTournamentCreated({ type: selectedTournamentType, competition: competition?.name || '' })
      const slug = `${tournamentName.toLowerCase().replace(/\s+/g, '_')}_${tournamentSlug}`
      router.push(`/vestiaire/${slug}/echauffement`)
    } catch (error) {
      console.error('Error creating tournament:', error)
      showAlert('Erreur', 'Une erreur est survenue lors de la création du tournoi', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <Navigation
          context="app"
          username={username || 'Utilisateur'}
          userAvatar={userAvatar || 'avatar1'}
          hideThemeToggle
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
          hideThemeToggle
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
          competitionLogo: competition.custom_emblem_color || competition.emblem,
          competitionLogoWhite: competition.custom_emblem_white,
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
                  Type de tournoi pré-sélectionné suite à votre achat
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
                  <span className="text-xs text-gray-500">Max 5 joueurs</span>
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
                      <Check className="w-3 h-3" /> {forcedType === 'oneshot' ? '1' : credits.oneshot_credits} crédit(s)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun crédit</span>
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
                      <Check className="w-3 h-3" /> {forcedType === 'elite' ? '1' : credits.elite_credits} crédit(s)
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun crédit</span>
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
                      <Check className="w-3 h-3" /> {forcedType === 'platinium' ? prepaidSlots : (credits.platinium_group_slots || credits.platinium_solo_credits)} place{(forcedType === 'platinium' ? prepaidSlots : (credits.platinium_group_slots || credits.platinium_solo_credits)) > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">Aucun crédit</span>
                  )}
                </div>
              </button>
            </div>

            {/* Lien vers pricing si pas de credits et pas de type force */}
            {!forcedType && (credits.oneshot_credits === 0 && credits.elite_credits === 0 && credits.platinium_solo_credits === 0 && credits.platinium_group_slots === 0) && (
              <div className="mt-4 text-center">
                <Link href="/pricing" className="text-sm text-orange-400 hover:text-orange-300 underline">
                  Acheter des crédits pour débloquer plus d'options
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
              <label htmlFor="input-max-players" className="block text-lg font-semibold theme-text mb-2 text-center">
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
                  aria-label="Diminuer le nombre de joueurs"
                >
                  −
                </button>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    id="input-max-players"
                    min={minPlayersLimit}
                    max={maxPlayersLimit}
                    value={maxPlayers}
                    aria-describedby="max-players-hint"
                    onChange={(e) => {
                      const val = parseInt(e.target.value)
                      if (!isNaN(val) && val >= minPlayersLimit && val <= maxPlayersLimit) {
                        setMaxPlayers(val)
                      }
                    }}
                    className="w-16 h-10 text-center text-xl font-bold theme-accent-text-always border-2 theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 theme-input"
                  />
                  <span id="max-players-hint" className="text-xs theme-text-secondary mt-1">participants</span>
                </div>
                <button
                  onClick={() => setMaxPlayers(Math.min(maxPlayersLimit, maxPlayers + 1))}
                  disabled={maxPlayers >= maxPlayersLimit}
                  className="btn-counter"
                  aria-label="Augmenter le nombre de joueurs"
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
              {(() => {
                // Limite de la formule (Free-Kick = 10, autres = illimité)
                const formulaLimit = selectedTournamentType === 'free' ? (pricingLimits.freeMaxMatchdays || 10) : Infinity
                // Max effectif = min entre la limite de formule et les journées restantes de la compétition
                const maxMatchdaysForType = Math.min(formulaLimit, competition.remaining_matchdays)
                // La formule limite-t-elle ? (Free-Kick avec plus de journées restantes que la limite)
                const isFormulaLimited = selectedTournamentType === 'free' && formulaLimit < competition.remaining_matchdays
                // La compétition limite-t-elle ? (moins de journées restantes que la limite de formule)
                const isCompetitionLimited = competition.remaining_matchdays <= formulaLimit
                const effectiveNumMatchdays = allMatchdays ? maxMatchdaysForType : Math.min(numMatchdays, maxMatchdaysForType)

                // Message à afficher
                let matchdayMessage: string
                if (isFormulaLimited) {
                  matchdayMessage = `Limité à ${formulaLimit} journées en Free-Kick`
                } else if (isCompetitionLimited) {
                  matchdayMessage = `Il ne reste que ${competition.remaining_matchdays} journée${competition.remaining_matchdays > 1 ? 's' : ''} dans la compétition`
                } else {
                  matchdayMessage = 'Le tournoi se déroulera sur :'
                }

                return (
                  <>
                    <label htmlFor="input-num-matchdays" className="block text-lg font-semibold theme-text mb-2 text-center">
                      Nombre de journées
                    </label>
                    <p className="text-sm theme-text-secondary mb-4 text-center">
                      {matchdayMessage}
                    </p>
                    <div className="flex items-start justify-center gap-3 mb-3">
                      <button
                        onClick={() => setNumMatchdays(Math.max(1, numMatchdays - 1))}
                        disabled={numMatchdays <= 1 || allMatchdays}
                        className="btn-counter"
                        aria-label="Diminuer le nombre de journées"
                      >
                        −
                      </button>
                      <div className="flex flex-col items-center">
                        <input
                          type="number"
                          id="input-num-matchdays"
                          min="1"
                          max={maxMatchdaysForType}
                          value={effectiveNumMatchdays}
                          aria-describedby="num-matchdays-hint"
                          onChange={(e) => {
                            const val = parseInt(e.target.value)
                            if (!isNaN(val) && val >= 1 && val <= maxMatchdaysForType) {
                              setNumMatchdays(val)
                            }
                          }}
                          disabled={allMatchdays}
                          className="w-16 h-10 text-center text-xl font-bold theme-accent-text-always border-2 theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 theme-input disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span id="num-matchdays-hint" className="text-xs theme-text-secondary mt-1">journées</span>
                      </div>
                      <button
                        onClick={() => setNumMatchdays(Math.min(maxMatchdaysForType, numMatchdays + 1))}
                        disabled={numMatchdays >= maxMatchdaysForType || allMatchdays}
                        className="btn-counter"
                        aria-label="Augmenter le nombre de journées"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <label htmlFor="toggle-all-matchdays" className="text-sm theme-text">
                        {isFormulaLimited
                          ? `Maximum (${maxMatchdaysForType})`
                          : `Toutes (${maxMatchdaysForType})`
                        }
                      </label>
                      <button
                        type="button"
                        id="toggle-all-matchdays"
                        aria-pressed={allMatchdays}
                        aria-label={isFormulaLimited ? `Activer maximum ${maxMatchdaysForType} journées` : `Activer toutes les ${maxMatchdaysForType} journées restantes`}
                        onClick={() => {
                          setAllMatchdays(!allMatchdays)
                          if (!allMatchdays) {
                            setNumMatchdays(maxMatchdaysForType)
                          }
                        }}
                        className={`toggle-switch ${allMatchdays ? 'active' : ''}`}
                        role="switch"
                      >
                        <span className="toggle-switch-knob" />
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Match bonus, Prime d'avant-match et Points pour match nul */}
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
                  aria-pressed={bonusMatchEnabled}
                  aria-label="Activer le match bonus"
                  onClick={() => setBonusMatchEnabled(!bonusMatchEnabled)}
                  className={`toggle-switch-lg ${bonusMatchEnabled ? 'active' : ''}`}
                  role="switch"
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
                Un point bonus par journée si toutes les rencontres sont pronostiquées avant l'horaire limite (30 minutes du coup d'envoi). Un seul oubli entraîne la perte de ce point : aide à lutter contre les forfaits.
              </p>
              <div className="flex justify-center">
                <button
                  type="button"
                  aria-pressed={earlyPredictionBonus}
                  aria-label="Activer la prime d'avant-match"
                  onClick={() => setEarlyPredictionBonus(!earlyPredictionBonus)}
                  className={`toggle-switch-lg ${earlyPredictionBonus ? 'active' : ''}`}
                  role="switch"
                >
                  <span className="toggle-switch-knob-lg" />
                </button>
              </div>
            </div>

            {/* Points pour match nul avec prono par défaut */}
            <div className="p-4 theme-dark-bg rounded-lg">
              <label htmlFor="input-default-points" className="block text-lg font-semibold theme-text mb-1 text-center">
                Score vierge
              </label>
              <p id="default-points-description" className="text-sm theme-text-secondary mb-3 text-center">
                En cas d'oubli et d'absence de pronostic, le 0-0 peut rapporter au mieux :
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setDrawWithDefaultPredictionPoints(Math.max(0, drawWithDefaultPredictionPoints - 1))}
                  disabled={drawWithDefaultPredictionPoints <= 0}
                  className="w-10 h-10 flex items-center justify-center theme-secondary-bg hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-xl font-bold theme-text transition"
                  aria-label="Diminuer les points pour score vierge"
                >
                  −
                </button>
                <input
                  type="number"
                  id="input-default-points"
                  min="0"
                  max="3"
                  value={drawWithDefaultPredictionPoints}
                  aria-describedby="default-points-description default-points-hint"
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
                  aria-label="Augmenter les points pour score vierge"
                >
                  +
                </button>
              </div>
              <p id="default-points-hint" className="text-center text-sm theme-text-secondary mt-2">
                Min: 0 | Max: 3 | Recommandé: 1
              </p>
            </div>
          </div>

          {/* Bonus du qualifié - uniquement pour les compétitions avec phases éliminatoires */}
          {competition.has_knockout_stages && (
            <div className="mb-8">
              <div className="p-4 theme-dark-bg rounded-lg flex flex-col items-center max-w-md mx-auto">
                <label className="block text-lg font-semibold theme-text mb-3 text-center">
                  Bonus du qualifié
                </label>
                <p className="text-sm theme-text-secondary mb-4 text-center">
                  Pour chaque match éliminatoire, les joueurs peuvent choisir l'équipe qui se qualifie.
                  +1 point bonus par bonne prédiction.
                </p>
                <div className="flex justify-center">
                  <button
                    type="button"
                    aria-pressed={bonusQualifiedEnabled}
                    aria-label="Activer le bonus du qualifié"
                    onClick={() => setBonusQualifiedEnabled(!bonusQualifiedEnabled)}
                    className={`toggle-switch-lg ${bonusQualifiedEnabled ? 'active' : ''}`}
                    role="switch"
                  >
                    <span className="toggle-switch-knob-lg" />
                  </button>
                </div>
              </div>
            </div>
          )}

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
              className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition font-semibold shadow-md"
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

      {/* Modal d'alerte */}
      {alertModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeAlert}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md theme-card rounded-xl shadow-2xl border theme-border overflow-hidden">
            {/* Header avec icône */}
            <div className={`px-6 py-4 flex items-center gap-3 ${
              alertModal.type === 'error' ? 'bg-red-500/10 border-b border-red-500/20' :
              alertModal.type === 'warning' ? 'bg-orange-500/10 border-b border-orange-500/20' :
              'bg-blue-500/10 border-b border-blue-500/20'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                alertModal.type === 'error' ? 'bg-red-500/20' :
                alertModal.type === 'warning' ? 'bg-orange-500/20' :
                'bg-blue-500/20'
              }`}>
                {alertModal.type === 'error' && <X className="w-5 h-5 text-red-500" />}
                {alertModal.type === 'warning' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                {alertModal.type === 'info' && <Info className="w-5 h-5 text-blue-500" />}
              </div>
              <h3 className={`text-lg font-semibold ${
                alertModal.type === 'error' ? 'text-red-400' :
                alertModal.type === 'warning' ? 'text-orange-400' :
                'text-blue-400'
              }`}>
                {alertModal.title}
              </h3>
              <button
                type="button"
                onClick={closeAlert}
                className="ml-auto p-1 rounded-lg hover:bg-gray-700/50 transition"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Contenu */}
            <div className="px-6 py-5">
              <p className="theme-text text-center">{alertModal.message}</p>
            </div>

            {/* Footer avec bouton */}
            <div className="px-6 py-4 border-t theme-border flex justify-center">
              <button
                type="button"
                onClick={closeAlert}
                className={`px-8 py-2.5 rounded-lg font-medium transition ${
                  alertModal.type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' :
                  alertModal.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600 text-white' :
                  'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

