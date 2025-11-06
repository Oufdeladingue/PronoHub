'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ThemeToggle from '@/components/ThemeToggle'

interface Tournament {
  id: string
  name: string
  slug: string
  competition_id: number
  competition_name: string
  max_players: number
  status: string
  num_matchdays?: number
  all_matchdays?: boolean
  starting_matchday?: number
  ending_matchday?: number
}

interface Match {
  id: number
  matchday: number
  utc_date: string
  home_team_name: string
  away_team_name: string
  home_team_crest: string | null
  away_team_crest: string | null
}

interface Prediction {
  match_id: number
  predicted_home_score: number | null
  predicted_away_score: number | null
}

export default function OppositionPage() {
  const params = useParams()
  const tournamentSlug = params.tournamentSlug as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competitionLogo, setCompetitionLogo] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pronostics' | 'classement' | 'regles'>('pronostics')
  const [username, setUsername] = useState<string>('utilisateur')
  const [pointsSettings, setPointsSettings] = useState<{
    exactScore: number
    correctResult: number
    incorrectResult: number
  }>({ exactScore: 3, correctResult: 1, incorrectResult: 0 })

  // États pour les pronostics
  const [availableMatchdays, setAvailableMatchdays] = useState<number[]>([])
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([]) // Tous les matchs du tournoi pour calculer les statuts
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [savingPrediction, setSavingPrediction] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [savedPredictions, setSavedPredictions] = useState<Record<number, boolean>>({}) // Suivi des pronos sauvegardés
  const [modifiedPredictions, setModifiedPredictions] = useState<Record<number, boolean>>({}) // Suivi des pronos modifiés

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  useEffect(() => {
    fetchCurrentUser()
    fetchTournamentData()
    fetchPointsSettings()
  }, [tournamentSlug])

  useEffect(() => {
    if (tournament?.competition_id) {
      fetchCompetitionLogo()
      fetchAvailableMatchdays()
      fetchAllMatches()
    }
  }, [tournament?.competition_id])

  useEffect(() => {
    if (selectedMatchday !== null && tournament) {
      fetchMatches()
      fetchUserPredictions()
    }
  }, [selectedMatchday, tournament])

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Récupérer le username depuis le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        if (profile?.username) {
          setUsername(profile.username)
        }
      }
    } catch (err) {
      console.error('Error fetching current user:', err)
    }
  }

  const fetchTournamentData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Récupérer le tournoi par le code (pas le slug complet)
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', tournamentCode)
        .single()

      if (tournamentError) throw new Error('Tournoi non trouvé')

      // Récupérer le nom de la compétition séparément
      const { data: competitionData } = await supabase
        .from('competitions')
        .select('name')
        .eq('id', tournamentData.competition_id)
        .single()

      setTournament({
        ...tournamentData,
        competition_name: competitionData?.name || 'Compétition'
      })
    } catch (err: any) {
      console.error('Erreur lors du chargement du tournoi:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchPointsSettings = async () => {
    try {
      const supabase = createClient()

      // Récupérer les paramètres de points depuis admin_settings
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])

      if (settings) {
        const exactScoreSetting = settings.find(s => s.setting_key === 'points_exact_score')
        const correctResultSetting = settings.find(s => s.setting_key === 'points_correct_result')
        const incorrectResultSetting = settings.find(s => s.setting_key === 'points_incorrect_result')

        setPointsSettings({
          exactScore: parseInt(exactScoreSetting?.setting_value || '3'),
          correctResult: parseInt(correctResultSetting?.setting_value || '1'),
          incorrectResult: parseInt(incorrectResultSetting?.setting_value || '0')
        })
      }
    } catch (err) {
      console.error('Erreur lors du chargement des paramètres de points:', err)
    }
  }

  const fetchCompetitionLogo = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('competitions')
        .select('emblem')
        .eq('id', tournament?.competition_id)
        .single()

      if (error) throw error
      if (data?.emblem) {
        setCompetitionLogo(data.emblem)
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement du logo:', err)
    }
  }

  const fetchAvailableMatchdays = async () => {
    try {
      if (!tournament) return

      // Utiliser les journées enregistrées au démarrage du tournoi
      const startMatchday = tournament.starting_matchday
      const endMatchday = tournament.ending_matchday

      if (!startMatchday || !endMatchday) {
        console.error('Le tournoi n\'a pas de journées définies')
        return
      }

      const matchdays: number[] = []
      for (let i = startMatchday; i <= endMatchday; i++) {
        matchdays.push(i)
      }

      setAvailableMatchdays(matchdays)

      // Sélectionner la prochaine journée à pronostiquer par défaut
      // Pour l'instant, on sélectionne la première journée disponible
      if (matchdays.length > 0 && selectedMatchday === null) {
        setSelectedMatchday(matchdays[0])
      }
    } catch (err) {
      console.error('Erreur lors du chargement des journées:', err)
    }
  }

  const fetchAllMatches = async () => {
    try {
      if (!tournament) return

      const supabase = createClient()

      // Utiliser les journées enregistrées au démarrage du tournoi
      const startMatchday = tournament.starting_matchday
      const endMatchday = tournament.ending_matchday

      if (!startMatchday || !endMatchday) {
        console.error('Le tournoi n\'a pas de journées définies')
        return
      }

      const { data: allMatchesData, error } = await supabase
        .from('imported_matches')
        .select('*')
        .eq('competition_id', tournament.competition_id)
        .gte('matchday', startMatchday)
        .lte('matchday', endMatchday)
        .order('utc_date', { ascending: true })

      if (error) throw error

      setAllMatches(allMatchesData || [])
    } catch (err) {
      console.error('Erreur lors du chargement de tous les matchs:', err)
    }
  }

  const fetchMatches = async () => {
    try {
      if (!tournament || selectedMatchday === null) return

      const supabase = createClient()
      const { data: matchesData, error } = await supabase
        .from('imported_matches')
        .select('*')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', selectedMatchday)
        .order('utc_date', { ascending: true })

      if (error) throw error

      setMatches(matchesData || [])

      // Initialiser les prédictions à 0-0 pour tous les matchs qui n'ont pas encore de prédiction
      if (matchesData) {
        setPredictions(prev => {
          const newPredictions = { ...prev }
          matchesData.forEach(match => {
            if (!newPredictions[match.id]) {
              newPredictions[match.id] = {
                match_id: match.id,
                predicted_home_score: 0,
                predicted_away_score: 0
              }
            }
          })
          return newPredictions
        })
      }
    } catch (err) {
      console.error('Erreur lors du chargement des matchs:', err)
    }
  }

  const fetchUserPredictions = async () => {
    try {
      if (!tournament || selectedMatchday === null) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const { data: predictionsData, error } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)

      if (error) {
        console.error('Erreur Supabase:', error)
        throw error
      }

      // Convertir en objet pour un accès rapide
      const predictionsMap: Record<number, Prediction> = {}
      const savedMap: Record<number, boolean> = {}
      predictionsData?.forEach(pred => {
        predictionsMap[pred.match_id] = pred
        savedMap[pred.match_id] = true // Marquer comme sauvegardé
      })

      setPredictions(predictionsMap)
      setSavedPredictions(savedMap)
    } catch (err) {
      console.error('Erreur lors du chargement des pronostics:', err)
      console.error('Type d\'erreur:', typeof err)
      console.error('Erreur stringifiée:', JSON.stringify(err, null, 2))
    }
  }

  const handleScoreChange = (matchId: number, team: 'home' | 'away', value: number) => {
    setPredictions(prev => ({
      ...prev,
      [matchId]: {
        match_id: matchId,
        predicted_home_score: team === 'home' ? value : (prev[matchId]?.predicted_home_score ?? null),
        predicted_away_score: team === 'away' ? value : (prev[matchId]?.predicted_away_score ?? null)
      }
    }))
    // Marquer comme modifié si déjà sauvegardé
    if (savedPredictions[matchId]) {
      setModifiedPredictions(prev => ({ ...prev, [matchId]: true }))
    }
  }

  const savePrediction = async (matchId: number) => {
    try {
      setSavingPrediction(matchId)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !tournament) return

      const prediction = predictions[matchId]
      if (prediction.predicted_home_score === null || prediction.predicted_away_score === null) {
        alert('Veuillez renseigner les deux scores')
        return
      }

      // Vérifier si un pronostic existe déjà
      const { data: existing } = await supabase
        .from('predictions')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .eq('match_id', matchId)
        .single()

      if (existing) {
        // Mettre à jour
        await supabase
          .from('predictions')
          .update({
            predicted_home_score: prediction.predicted_home_score,
            predicted_away_score: prediction.predicted_away_score
          })
          .eq('id', existing.id)
      } else {
        // Créer
        await supabase
          .from('predictions')
          .insert({
            tournament_id: tournament.id,
            user_id: user.id,
            match_id: matchId,
            predicted_home_score: prediction.predicted_home_score,
            predicted_away_score: prediction.predicted_away_score
          })
      }

      // Marquer comme sauvegardé et non modifié
      setSavedPredictions(prev => ({ ...prev, [matchId]: true }))
      setModifiedPredictions(prev => ({ ...prev, [matchId]: false }))

      console.log('Pronostic enregistré avec succès')
    } catch (err) {
      console.error('Erreur lors de l\'enregistrement du pronostic:', err)
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setSavingPrediction(null)
    }
  }

  // Déterminer le statut d'une journée
  const getMatchdayStatus = (matchday: number): string => {
    if (!allMatches.length) return 'À venir'

    // Récupérer les matchs de cette journée depuis allMatches
    const matchdayMatches = allMatches.filter(m => m.matchday === matchday)
    if (matchdayMatches.length === 0) return 'À venir'

    const now = new Date()

    // Vérifier si tous les matchs sont terminés (plus de 2h après le dernier match)
    const lastMatchTime = new Date(Math.max(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursAfterLastMatch = (now.getTime() - lastMatchTime.getTime()) / (1000 * 60 * 60)

    if (hoursAfterLastMatch > 2) {
      return 'Terminée'
    }

    // Vérifier si au moins un match a commencé
    const firstMatchTime = new Date(Math.min(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursUntilFirstMatch = (firstMatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilFirstMatch < 0) {
      return 'En cours'
    }

    return 'À venir'
  }

  // Grouper les matchs par date
  const groupMatchesByDate = (matches: Match[]) => {
    const groups: Record<string, Match[]> = {}
    matches.forEach(match => {
      const date = new Date(match.utc_date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(match)
    })
    return groups
  }

  // Vérifier si les pronostics sont clôturés
  const arePronosticsClosed = () => {
    if (matches.length === 0) return false
    const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
    const closingTime = new Date(firstMatchTime.getTime() - 60 * 60 * 1000)
    return new Date() >= closingTime
  }

  // Calculer le temps restant avant la clôture des pronostics (1h avant le 1er match)
  const calculateTimeRemaining = () => {
    if (matches.length === 0) return ''

    const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
    const closingTime = new Date(firstMatchTime.getTime() - 60 * 60 * 1000) // 1 heure avant
    const now = new Date()
    const diff = closingTime.getTime() - now.getTime()

    if (diff <= 0) {
      return 'Pronostics clôturés'
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (days > 0) {
      return `${days}j ${hours}h ${minutes}min`
    } else if (hours > 0) {
      return `${hours}h ${minutes}min ${seconds}s`
    } else {
      return `${minutes}min ${seconds}s`
    }
  }

  // Timer en temps réel
  useEffect(() => {
    if (matches.length === 0) return

    const updateTimer = () => {
      setTimeRemaining(calculateTimeRemaining())
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [matches])

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen theme-bg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff9900] mx-auto"></div>
            <p className="mt-4 theme-text">Chargement du tournoi...</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  if (error || !tournament) {
    return (
      <ThemeProvider>
        <div className="min-h-screen theme-bg flex items-center justify-center">
          <div className="text-center theme-card max-w-md p-8">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold theme-text mb-2">Tournoi introuvable</h2>
            <p className="theme-text-secondary mb-6">{error || 'Ce tournoi n\'existe pas ou a été supprimé.'}</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-[#ff9900] text-[#111] rounded-lg hover:bg-[#e68a00] transition font-semibold"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen theme-bg">
        {/* Header */}
        <div className="theme-nav">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <img src="/images/logo.svg" alt="PronoHub" className="w-14 h-14 cursor-pointer hover:opacity-80 transition" />
                </Link>
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-4">
                {competitionLogo && (
                  <img
                    src={competitionLogo}
                    alt={tournament.competition_name}
                    className="w-16 h-16 object-contain"
                  />
                )}
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold theme-text">{tournament.name}</h1>
                    <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                      En cours
                    </span>
                  </div>
                  <p className="theme-text-secondary mt-1">{tournament.competition_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="theme-text text-sm">Bonjour, {username} !</span>

                {/* Séparateur */}
                <div className="h-6 w-[2px] bg-[#e68a00]"></div>

                {/* Lien Carrière avec icône */}
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer"
                  style={{ color: 'var(--theme-accent, #ff9900)' }}
                >
                  <img
                    src="/images/icons/profil.svg"
                    alt="Carrière"
                    className="w-5 h-5"
                    style={{ filter: 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)' }}
                  />
                  Carrière
                </Link>

                {/* Séparateur */}
                <div className="h-6 w-[2px] bg-[#e68a00]"></div>

                {/* Bouton Déconnexion avec icône */}
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded transition-all duration-200 hover:scale-105 cursor-pointer"
                    style={{ color: 'var(--theme-accent, #ff9900)' }}
                  >
                    <img
                      src="/images/icons/logout.svg"
                      alt="Quitter"
                      className="w-5 h-5"
                      style={{ filter: 'invert(62%) sepia(46%) saturate(1614%) hue-rotate(1deg) brightness(103%) contrast(101%)' }}
                    />
                    Quitter le terrain
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation par onglets */}
        <div className="max-w-7xl mx-auto px-4 mt-6">
          <div className="flex gap-2 border-b theme-border">
            <button
              onClick={() => setActiveTab('pronostics')}
              className={`px-6 py-3 font-semibold transition-all relative ${
                activeTab === 'pronostics'
                  ? 'theme-text border-b-2 border-[#ff9900]'
                  : 'theme-text-secondary hover:theme-text'
              }`}
            >
              Pronostics
            </button>
            <button
              onClick={() => setActiveTab('classement')}
              className={`px-6 py-3 font-semibold transition-all relative ${
                activeTab === 'classement'
                  ? 'theme-text border-b-2 border-[#ff9900]'
                  : 'theme-text-secondary hover:theme-text'
              }`}
            >
              Classement
            </button>
            <button
              onClick={() => setActiveTab('regles')}
              className={`px-6 py-3 font-semibold transition-all relative ${
                activeTab === 'regles'
                  ? 'theme-text border-b-2 border-[#ff9900]'
                  : 'theme-text-secondary hover:theme-text'
              }`}
            >
              Règles
            </button>
          </div>
        </div>

        {/* Contenu des onglets */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {activeTab === 'pronostics' && (
            <div className="theme-card">
              {/* Menu de navigation des journées */}
              {availableMatchdays.length > 0 && (
                <div className="mb-6 pb-6 border-b theme-border overflow-x-auto">
                  <div className="flex gap-2">
                    {availableMatchdays.map(matchday => {
                      const matchdayStatus = getMatchdayStatus(matchday)
                      return (
                        <button
                          key={matchday}
                          onClick={() => setSelectedMatchday(matchday)}
                          className={`px-4 py-3 rounded-lg font-semibold transition whitespace-nowrap flex flex-col items-center min-w-[80px] ${
                            selectedMatchday === matchday
                              ? 'bg-[#ff9900] text-[#111]'
                              : 'bg-gray-100 text-gray-700 hover:bg-[#ff9900] hover:text-[#111]'
                          }`}
                        >
                          <span className="text-lg">J{matchday}</span>
                          <span className={`text-xs mt-1 ${
                            selectedMatchday === matchday ? 'text-[#111]' : 'text-gray-500'
                          }`}>
                            {matchdayStatus}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Liste des matchs */}
              <div>
                {matches.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="theme-text-secondary">
                      Aucun match disponible pour cette journée
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Timer avant le premier match */}
                    {timeRemaining && (
                      <div className={`p-4 rounded-lg text-center ${
                        timeRemaining === 'Pronostics clôturés'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                      }`}>
                        <div className="flex items-center justify-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">
                            {timeRemaining === 'Pronostics clôturés'
                              ? 'Pronostics clôturés pour cette journée'
                              : `Temps restant pour valider vos pronostics : ${timeRemaining}`
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {Object.entries(groupMatchesByDate(matches)).map(([date, dateMatches]) => (
                      <div key={date}>
                        {/* En-tête de date */}
                        <div className="mb-4">
                          <h3 className="text-lg font-bold theme-text capitalize">
                            {date}
                          </h3>
                        </div>

                        {/* Matchs du jour */}
                        <div className="space-y-3">
                          {dateMatches.map(match => {
                            const prediction = predictions[match.id] || { match_id: match.id, predicted_home_score: 0, predicted_away_score: 0 }
                            const matchTime = new Date(match.utc_date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            const isClosed = arePronosticsClosed()
                            const isSaved = savedPredictions[match.id]
                            const isModified = modifiedPredictions[match.id]

                            // Déterminer la couleur de bordure
                            let borderColor = 'border-gray-300 dark:border-gray-600' // Par défaut
                            if (isClosed) {
                              borderColor = 'border-gray-400 dark:border-gray-500'
                            } else if (isModified) {
                              borderColor = 'border-orange-400 dark:border-orange-500'
                            } else if (isSaved) {
                              borderColor = 'border-green-400 dark:border-green-500'
                            }

                            return (
                              <div
                                key={match.id}
                                className={`flex items-center gap-4 p-4 theme-card hover:shadow-lg transition border-2 ${borderColor} ${isClosed ? 'opacity-75' : ''}`}
                              >
                                {/* Horaire */}
                                <div className="w-16 text-sm theme-text-secondary font-semibold">
                                  {matchTime}
                                </div>

                                {/* Équipe domicile */}
                                <div className="flex items-center gap-3 flex-1 justify-end">
                                  <span className="theme-text font-medium text-right">
                                    {match.home_team_name}
                                  </span>
                                  {match.home_team_crest && (
                                    <img
                                      src={match.home_team_crest}
                                      alt={match.home_team_name}
                                      className="w-8 h-8 object-contain"
                                    />
                                  )}
                                </div>

                                {/* Score domicile */}
                                <div className="flex items-center gap-1">
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => {
                                        const newValue = Math.min(9, (prediction.predicted_home_score ?? 0) + 1)
                                        handleScoreChange(match.id, 'home', newValue)
                                      }}
                                      disabled={isClosed}
                                      className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      +
                                    </button>
                                    <button
                                      onClick={() => {
                                        const newValue = Math.max(0, (prediction.predicted_home_score ?? 0) - 1)
                                        handleScoreChange(match.id, 'home', newValue)
                                      }}
                                      disabled={isClosed}
                                      className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      −
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    value={prediction.predicted_home_score ?? 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value)
                                      if (!isNaN(val) && val >= 0 && val <= 9) {
                                        handleScoreChange(match.id, 'home', val)
                                      }
                                    }}
                                    disabled={isClosed}
                                    className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </div>

                                {/* Séparateur */}
                                <span className="theme-text-secondary font-bold text-xl">−</span>

                                {/* Score extérieur */}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="9"
                                    value={prediction.predicted_away_score ?? 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value)
                                      if (!isNaN(val) && val >= 0 && val <= 9) {
                                        handleScoreChange(match.id, 'away', val)
                                      }
                                    }}
                                    className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      onClick={() => {
                                        const newValue = Math.min(9, (prediction.predicted_away_score ?? 0) + 1)
                                        handleScoreChange(match.id, 'away', newValue)
                                      }}
                                      className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition"
                                    >
                                      +
                                    </button>
                                    <button
                                      onClick={() => {
                                        const newValue = Math.max(0, (prediction.predicted_away_score ?? 0) - 1)
                                        handleScoreChange(match.id, 'away', newValue)
                                      }}
                                      className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition"
                                    >
                                      −
                                    </button>
                                  </div>
                                </div>

                                {/* Équipe extérieure */}
                                <div className="flex items-center gap-3 flex-1">
                                  {match.away_team_crest && (
                                    <img
                                      src={match.away_team_crest}
                                      alt={match.away_team_name}
                                      className="w-8 h-8 object-contain"
                                    />
                                  )}
                                  <span className="theme-text font-medium">
                                    {match.away_team_name}
                                  </span>
                                </div>

                                {/* Indicateur et bouton d'état */}
                                <div className="flex items-center gap-2">
                                  {isClosed ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-sm font-medium">Clôturé</span>
                                    </div>
                                  ) : isSaved && !isModified ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      <span className="text-sm font-medium">Enregistré</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => savePrediction(match.id)}
                                      disabled={savingPrediction === match.id}
                                      className={`px-4 py-2 rounded-lg transition font-semibold flex items-center gap-2 ${
                                        isModified
                                          ? 'bg-orange-500 dark:bg-orange-600 text-white hover:bg-orange-600 dark:hover:bg-orange-700'
                                          : 'bg-[#ff9900] text-[#111] hover:bg-[#e68a00]'
                                      } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                                    >
                                      {savingPrediction === match.id ? (
                                        <>
                                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                          </svg>
                                          <span>Envoi...</span>
                                        </>
                                      ) : isModified ? (
                                        <>
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                          </svg>
                                          <span>Modifier</span>
                                        </>
                                      ) : (
                                        <span>Enregistrer</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'classement' && (
            <div className="theme-card">
              <h2 className="text-2xl font-bold theme-text mb-4">Classement</h2>
              <p className="theme-text-secondary">
                Le classement général du tournoi sera affiché ici.
              </p>
              {/* Le contenu du classement sera ajouté ici */}
            </div>
          )}

          {activeTab === 'regles' && (
            <div className="theme-card">
              <h2 className="text-2xl font-bold theme-text mb-4">Règles du tournoi</h2>
              <div className="space-y-4 theme-text-secondary">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Système de points</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Score exact : {pointsSettings.exactScore} {pointsSettings.exactScore > 1 ? 'points' : 'point'}</li>
                    <li>Bon résultat (victoire/nul/défaite) : {pointsSettings.correctResult} {pointsSettings.correctResult > 1 ? 'points' : 'point'}</li>
                    <li>Mauvais pronostic : {pointsSettings.incorrectResult} point</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold theme-text mb-2">Configuration du tournoi</h3>
                  <p>
                    Pour ce tournoi, vous avez opté pour{' '}
                    {tournament?.all_matchdays ? (
                      <span className="font-semibold theme-text">toutes les journées de compétition</span>
                    ) : (
                      <>
                        <span className="font-semibold theme-text">{tournament?.num_matchdays || 0}</span>{' '}
                        {tournament?.num_matchdays && tournament.num_matchdays > 1 ? 'journées' : 'journée'} de compétition
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold theme-text mb-2">Délais de pronostic</h3>
                  <p>
                    Les pronostics doivent être saisis avant le coup d'envoi du match.{' '}
                    <span className="font-semibold theme-text">
                      Si un score n'est pas renseigné une heure avant le coup d'envoi du premier match de la journée de compétition,
                      c'est le score de 0-0 qui est validé par défaut.
                    </span>
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold theme-text mb-2">Classement</h3>
                  <p>Le classement est mis à jour après chaque journée de matchs. En cas d'égalité, le nombre de scores exacts départage les joueurs.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ThemeProvider>
  )
}
