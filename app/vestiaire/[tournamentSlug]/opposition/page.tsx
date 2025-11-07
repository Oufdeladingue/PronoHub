'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ThemeProvider } from '@/contexts/ThemeContext'
import TournamentNav from '@/components/TournamentNav'
import TournamentRankings from '@/components/TournamentRankings'
import { getAvatarUrl } from '@/lib/avatars'

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
  finished?: boolean
  home_score?: number | null
  away_score?: number | null
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
  const [userAvatar, setUserAvatar] = useState<string>('avatar1')
  const [userId, setUserId] = useState<string | null>(null)
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
  const [lockedPredictions, setLockedPredictions] = useState<Record<number, boolean>>({}) // Suivi des pronos verrouillés

  // États pour le classement
  const [rankingsView, setRankingsView] = useState<'general' | number>('general')
  const [rankings, setRankings] = useState<any[]>([])
  const [loadingRankings, setLoadingRankings] = useState(false)

  // États pour les matchs bonus
  const [bonusMatchIds, setBonusMatchIds] = useState<Set<number>>(new Set())

  // État pour les points gagnés par match
  const [matchPoints, setMatchPoints] = useState<Record<number, number>>({})

  // État pour les points totaux de la journée
  const [matchdayTotalPoints, setMatchdayTotalPoints] = useState<number>(0)

  // États pour les accordéons de pronostics des autres
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set())
  const [allPlayersPredictions, setAllPlayersPredictions] = useState<Record<number, any[]>>({})

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
      fetchBonusMatches()
    }
  }, [tournament?.competition_id])

  useEffect(() => {
    if (selectedMatchday !== null && tournament) {
      // Charger d'abord les prédictions utilisateur, puis les matchs
      const loadData = async () => {
        await fetchUserPredictions()
        await fetchMatches()
        await fetchMatchPoints()
      }
      loadData()
    }
  }, [selectedMatchday, tournament])

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        // Récupérer le username et avatar depuis le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('id', user.id)
          .single()

        if (profile?.username) {
          setUsername(profile.username)
        }
        if (profile?.avatar) {
          setUserAvatar(profile.avatar)
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

  const findNextMatchdayToPlay = async (matchdays: number[]) => {
    if (!tournament) return

    const supabase = createClient()

    // Pour chaque journée, vérifier si elle est clôturée
    for (const matchday of matchdays) {
      const { data: matchesData } = await supabase
        .from('imported_matches')
        .select('utc_date')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', matchday)
        .order('utc_date', { ascending: true })
        .limit(1)

      if (matchesData && matchesData.length > 0) {
        const firstMatchTime = new Date(matchesData[0].utc_date)
        const closingTime = new Date(firstMatchTime.getTime() - 60 * 60 * 1000) // 1h avant
        const now = new Date()

        // Si cette journée n'est pas encore clôturée, on la sélectionne
        if (now < closingTime) {
          setSelectedMatchday(matchday)
          return
        }
      }
    }

    // Si toutes les journées sont clôturées, sélectionner la dernière
    setSelectedMatchday(matchdays[matchdays.length - 1])
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
      if (matchdays.length > 0 && selectedMatchday === null) {
        // Trouver la première journée non clôturée
        findNextMatchdayToPlay(matchdays)
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

  const fetchBonusMatches = async () => {
    try {
      if (!tournament) return

      const response = await fetch(`/api/tournaments/${tournament.id}/bonus-matches`)
      if (!response.ok) return

      const data = await response.json()
      if (data.bonusMatches) {
        const bonusIds = new Set(data.bonusMatches.map((bm: any) => bm.match_id))
        setBonusMatchIds(bonusIds)
      }
    } catch (err) {
      console.error('Erreur lors du chargement des matchs bonus:', err)
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
          console.log('🔄 fetchMatches - État actuel des prédictions:', Object.keys(prev).length, 'matchs')
          const newPredictions = { ...prev }
          let addedCount = 0
          matchesData.forEach(match => {
            if (!newPredictions[match.id]) {
              newPredictions[match.id] = {
                match_id: match.id,
                predicted_home_score: 0,
                predicted_away_score: 0
              }
              addedCount++
            }
          })
          console.log('🔄 fetchMatches - Ajout de', addedCount, 'prédictions à 0-0')
          console.log('🔄 fetchMatches - Total après:', Object.keys(newPredictions).length, 'matchs')
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

      // D'abord, récupérer les IDs des matchs de la journée sélectionnée
      const { data: matchesData } = await supabase
        .from('imported_matches')
        .select('id')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', selectedMatchday)

      if (!matchesData || matchesData.length === 0) return

      const matchIds = matchesData.map(m => m.id)

      // Ensuite, récupérer les prédictions pour ces matchs
      const { data: predictionsData, error } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      if (error) {
        console.error('Erreur Supabase:', error)
        throw error
      }

      // Convertir en objet pour un accès rapide
      const predictionsMap: Record<number, Prediction> = {}
      const savedMap: Record<number, boolean> = {}
      const lockedMap: Record<number, boolean> = {}
      predictionsData?.forEach(pred => {
        predictionsMap[pred.match_id] = pred
        savedMap[pred.match_id] = true // Marquer comme sauvegardé
        lockedMap[pred.match_id] = true // Marquer comme verrouillé
      })

      console.log('📥 Pronostics chargés depuis la BDD:', predictionsData?.length || 0)
      console.log('📥 Détails:', predictionsData?.map(p => ({
        matchId: p.match_id,
        scores: `${p.predicted_home_score}-${p.predicted_away_score}`
      })))

      setPredictions(predictionsMap)
      setSavedPredictions(savedMap)
      setLockedPredictions(lockedMap)
    } catch (err) {
      console.error('Erreur lors du chargement des pronostics:', err)
      console.error('Type d\'erreur:', typeof err)
      console.error('Erreur stringifiée:', JSON.stringify(err, null, 2))
    }
  }

  const fetchMatchPoints = async () => {
    try {
      if (!tournament || selectedMatchday === null) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Récupérer les matchs terminés de cette journée
      const { data: matchesData } = await supabase
        .from('imported_matches')
        .select('id, home_score, away_score, finished')
        .eq('competition_id', tournament.competition_id)
        .eq('matchday', selectedMatchday)
        .eq('finished', true)

      if (!matchesData || matchesData.length === 0) return

      const matchIds = matchesData.map(m => m.id)

      // Récupérer les pronostics de l'utilisateur pour ces matchs
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      if (!predictionsData) return

      // Récupérer les matchs bonus
      const isBonusMatch = (matchId: number) => bonusMatchIds.has(matchId)

      // Calculer les points pour chaque match
      const pointsMap: Record<number, number> = {}
      for (const prediction of predictionsData) {
        const match = matchesData.find(m => m.id === prediction.match_id)
        if (!match || match.home_score === null || match.away_score === null) continue

        const pred_home = prediction.predicted_home_score
        const pred_away = prediction.predicted_away_score

        if (pred_home === null || pred_away === null) continue

        // Calculer les points
        const isExact = pred_home === match.home_score && pred_away === match.away_score
        const predOutcome = pred_home > pred_away ? 'H' : (pred_home < pred_away ? 'A' : 'D')
        const realOutcome = match.home_score > match.away_score ? 'H' : (match.home_score < match.away_score ? 'A' : 'D')
        const isCorrect = predOutcome === realOutcome

        let points = 0
        if (isExact) {
          points = pointsSettings.exactScore
        } else if (isCorrect) {
          points = pointsSettings.correctResult
        } else {
          points = pointsSettings.incorrectResult
        }

        // Doubler si match bonus
        if (isBonusMatch(prediction.match_id)) {
          points *= 2
        }

        pointsMap[prediction.match_id] = points
      }

      setMatchPoints(pointsMap)

      // Calculer le total des points pour cette journée
      const totalPoints = Object.values(pointsMap).reduce((sum, pts) => sum + pts, 0)
      setMatchdayTotalPoints(totalPoints)
    } catch (err) {
      console.error('Erreur lors du chargement des points:', err)
    }
  }

  // Fonction pour récupérer les pronostics de tous les participants pour un match
  const fetchAllPlayersPredictionsForMatch = async (matchId: number, match: Match) => {
    try {
      if (!tournament || !userId) return

      // Appeler l'API pour récupérer tous les pronostics (bypass RLS)
      const response = await fetch(`/api/tournaments/${tournament.id}/match-predictions?matchId=${matchId}`)

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des pronostics')
      }

      const data = await response.json()
      const predictions = data.predictions

      if (!predictions) return

      // Créer un tableau avec les pronostics de chaque participant
      const playersPredictions = predictions
        .filter((p: any) => p.user_id !== userId) // Exclure l'utilisateur actuel
        .map((prediction: any) => {
          const username = prediction.username

          if (!prediction.has_prediction) {
            return {
              username,
              avatar: prediction.avatar || 'avatar1',
              predictedHome: 0,
              predictedAway: 0,
              hasPronostic: false,
              points: 0,
              isExact: false,
              isCorrect: false
            }
          }

          // Calculer les points si le match est terminé
          let points = 0
          let isExact = false
          let isCorrect = false

          if (match.finished && match.home_score !== null && match.away_score !== null) {
            isExact = prediction.predicted_home_score === match.home_score && prediction.predicted_away_score === match.away_score
            const predOutcome = prediction.predicted_home_score > prediction.predicted_away_score ? 'H' : (prediction.predicted_home_score < prediction.predicted_away_score ? 'A' : 'D')
            const realOutcome = match.home_score > match.away_score ? 'H' : (match.home_score < match.away_score ? 'A' : 'D')
            isCorrect = predOutcome === realOutcome

            if (isExact) {
              points = pointsSettings.exactScore
            } else if (isCorrect) {
              points = pointsSettings.correctResult
            } else {
              points = pointsSettings.incorrectResult
            }

            // Doubler si match bonus
            if (bonusMatchIds.has(matchId)) {
              points *= 2
            }
          }

          return {
            username,
            avatar: prediction.avatar || 'avatar1',
            predictedHome: prediction.predicted_home_score,
            predictedAway: prediction.predicted_away_score,
            hasPronostic: true,
            points,
            isExact,
            isCorrect
          }
        })
        .sort((a: any, b: any) => b.points - a.points) // Trier par points décroissants

      setAllPlayersPredictions(prev => ({
        ...prev,
        [matchId]: playersPredictions
      }))
    } catch (err) {
      console.error('Erreur lors du chargement des pronostics des autres:', err)
    }
  }

  // Fonction pour toggle l'accordéon
  const toggleMatchExpansion = async (matchId: number, match: Match) => {
    const newExpanded = new Set(expandedMatches)

    if (newExpanded.has(matchId)) {
      newExpanded.delete(matchId)
    } else {
      newExpanded.add(matchId)
      // Charger les pronostics si pas déjà chargés
      if (!allPlayersPredictions[matchId]) {
        await fetchAllPlayersPredictionsForMatch(matchId, match)
      }
    }

    setExpandedMatches(newExpanded)
  }

  // Fonction pour obtenir les styles de couleur en fonction des points
  const getPointsColorStyle = (points: number) => {
    if (points === 0) {
      return { backgroundColor: '#e5e7eb', color: '#0f172a' } // Gris
    } else if (points === 2) {
      return { backgroundColor: '#ea580c', color: '#0f172a' } // Orange foncé
    } else if (points === 3) {
      return { backgroundColor: '#fb923c', color: '#0f172a' } // Orange pâle
    } else if (points === 4) {
      return { backgroundColor: '#86efac', color: '#0f172a' } // Vert clair
    } else if (points === 5) {
      return { backgroundColor: '#22c55e', color: '#0f172a' } // Vert
    } else if (points === 6) {
      return { backgroundColor: '#16a34a', color: '#ffffff' } // Vert plus foncé
    } else if (points === 10) {
      return { backgroundColor: '#fbbf24', color: '#0f172a' } // Or
    } else {
      return { backgroundColor: '#22c55e', color: '#0f172a' } // Défaut vert
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

  const unlockPrediction = (matchId: number) => {
    setLockedPredictions(prev => ({ ...prev, [matchId]: false }))
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
        const { error: updateError } = await supabase
          .from('predictions')
          .update({
            predicted_home_score: prediction.predicted_home_score,
            predicted_away_score: prediction.predicted_away_score
          })
          .eq('id', existing.id)

        if (updateError) {
          console.error('Erreur lors de la mise à jour:', updateError)
          throw updateError
        }
        console.log('✅ Pronostic mis à jour:', { matchId, scores: `${prediction.predicted_home_score}-${prediction.predicted_away_score}` })
      } else {
        // Créer
        const { error: insertError } = await supabase
          .from('predictions')
          .insert({
            tournament_id: tournament.id,
            user_id: user.id,
            match_id: matchId,
            predicted_home_score: prediction.predicted_home_score,
            predicted_away_score: prediction.predicted_away_score
          })

        if (insertError) {
          console.error('Erreur lors de l\'insertion:', insertError)
          throw insertError
        }
        console.log('✅ Pronostic créé:', { matchId, scores: `${prediction.predicted_home_score}-${prediction.predicted_away_score}` })
      }

      // Marquer comme sauvegardé, non modifié et verrouillé
      setSavedPredictions(prev => ({ ...prev, [matchId]: true }))
      setModifiedPredictions(prev => ({ ...prev, [matchId]: false }))
      setLockedPredictions(prev => ({ ...prev, [matchId]: true }))

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

    // Vérifier si la journée est en cours (1h avant le premier match ou après)
    const firstMatchTime = new Date(Math.min(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursUntilFirstMatch = (firstMatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilFirstMatch < 1) {
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
        <TournamentNav
          tournamentName={tournament.name}
          competitionName={tournament.competition_name}
          competitionLogo={competitionLogo}
          status="active"
          username={username}
          userAvatar={userAvatar}
        />

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
                      const isFinished = matchdayStatus === 'Terminée'
                      return (
                        <button
                          key={matchday}
                          onClick={() => setSelectedMatchday(matchday)}
                          className={`px-4 py-3 rounded-lg font-semibold transition whitespace-nowrap flex flex-col items-center min-w-[80px] ${
                            selectedMatchday === matchday
                              ? 'bg-[#ff9900] text-[#111]'
                              : isFinished
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 opacity-60'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-[#ff9900] hover:text-[#111]'
                          }`}
                        >
                          <span className="text-lg">J{matchday}</span>
                          <span className={`text-xs mt-1 ${
                            selectedMatchday === matchday ? 'text-[#111]' : isFinished ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'
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
                      <div className="p-4 rounded-lg text-center theme-bg text-[#ff9900]">
                        <div className="flex items-center justify-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold">
                            {timeRemaining === 'Pronostics clôturés'
                              ? `Pronostics clôturés pour cette journée : vous avez marqué ${matchdayTotalPoints} pts`
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
                          <h3 className="text-sm font-bold theme-text capitalize text-center">
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
                            const isLocked = lockedPredictions[match.id]
                            const isBonusMatch = bonusMatchIds.has(match.id)

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
                                className={`relative flex flex-col p-4 theme-card hover:shadow-lg transition border-2 ${borderColor} ${isClosed ? 'opacity-75' : ''}`}
                              >
                                <style jsx>{`
                                  @keyframes pulse-bonus {
                                    0%, 100% {
                                      opacity: 1;
                                      transform: scale(1);
                                    }
                                    50% {
                                      opacity: 0.7;
                                      transform: scale(1.05);
                                    }
                                  }
                                  .bonus-badge {
                                    animation: pulse-bonus 2s ease-in-out infinite;
                                  }
                                `}</style>

                                {/* Contenu principal du match */}
                                <div className="grid items-center gap-4" style={{ gridTemplateColumns: '80px 1fr auto 1fr 192px' }}>
                                  {/* Horaire et badge bonus */}
                                  <div className="flex flex-col items-center gap-1 w-20">
                                  <div className="text-sm theme-text-secondary font-semibold">
                                    {matchTime}
                                  </div>
                                  {isBonusMatch && (
                                    <div className="bonus-badge flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded text-[10px] font-bold text-white shadow-lg">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                      </svg>
                                      <span>BONUS</span>
                                    </div>
                                  )}
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

                                {/* Zone centrale avec scores */}
                                <div className="flex flex-col items-center gap-3 flex-1">
                                  {/* Vrai score si match terminé */}
                                  {match.finished && match.home_score !== null && match.away_score !== null && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded">
                                      <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                        Score final :
                                      </span>
                                      <span className="text-sm font-bold text-green-700 dark:text-green-400">
                                        {match.home_score} - {match.away_score}
                                      </span>
                                    </div>
                                  )}

                                  {/* Ligne de pronostic */}
                                  <div className="flex items-center gap-3">
                                    {/* Score domicile */}
                                    <div className="flex items-center gap-1">
                                      {!isClosed && (
                                        <div className="flex flex-col gap-0.5">
                                          <button
                                            onClick={() => {
                                              const newValue = Math.min(9, (prediction.predicted_home_score ?? 0) + 1)
                                              handleScoreChange(match.id, 'home', newValue)
                                            }}
                                            disabled={isLocked}
                                            className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            +
                                          </button>
                                          <button
                                            onClick={() => {
                                              const newValue = Math.max(0, (prediction.predicted_home_score ?? 0) - 1)
                                              handleScoreChange(match.id, 'home', newValue)
                                            }}
                                            disabled={isLocked}
                                            className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            −
                                          </button>
                                        </div>
                                      )}
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
                                        disabled={isClosed || isLocked}
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
                                        disabled={isClosed || isLocked}
                                        className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                      />
                                      {!isClosed && (
                                        <div className="flex flex-col gap-0.5">
                                          <button
                                            onClick={() => {
                                              const newValue = Math.min(9, (prediction.predicted_away_score ?? 0) + 1)
                                              handleScoreChange(match.id, 'away', newValue)
                                            }}
                                            disabled={isLocked}
                                            className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            +
                                          </button>
                                          <button
                                            onClick={() => {
                                              const newValue = Math.max(0, (prediction.predicted_away_score ?? 0) - 1)
                                              handleScoreChange(match.id, 'away', newValue)
                                            }}
                                            disabled={isLocked}
                                            className="w-6 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            −
                                          </button>
                                        </div>
                                      )}
                                    </div>
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
                                <div className="flex items-center justify-end gap-2 w-48">
                                  {isClosed ? (
                                    matchPoints[match.id] !== undefined ? (
                                      <div
                                        className="px-4 py-2 rounded-lg font-bold text-sm"
                                        style={getPointsColorStyle(matchPoints[match.id])}
                                      >
                                        {matchPoints[match.id] > 0 ? `+${matchPoints[match.id]}` : '0'} pts
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 opacity-50 cursor-not-allowed">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-sm font-medium">Clôturé</span>
                                      </div>
                                    )
                                  ) : isSaved && !isModified && isLocked ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center justify-center w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-700 dark:text-green-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <button
                                        onClick={() => unlockPrediction(match.id)}
                                        className="flex items-center justify-center w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                                        title="Modifier le pronostic"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                        </svg>
                                      </button>
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

                                {/* Accordéon pour voir les pronostics des autres (seulement si journée clôturée) */}
                                {isClosed && (
                                  <div className="mt-3 border-t theme-border pt-3">
                                    <button
                                      onClick={() => toggleMatchExpansion(match.id, match)}
                                      className="w-full px-2 py-2 text-xs transition hover:opacity-80 flex items-center justify-center gap-2 theme-text"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-3 w-3"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        {expandedMatches.has(match.id) ? (
                                          <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                        ) : (
                                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                        )}
                                      </svg>
                                      <span>Voir les pronostics de mes adversaires</span>
                                    </button>

                                    {/* Contenu de l'accordéon */}
                                    {expandedMatches.has(match.id) && allPlayersPredictions[match.id] && (
                                      <div className="mt-3 space-y-2 animate-fadeIn">
                                        {allPlayersPredictions[match.id].length === 0 ? (
                                          <p className="text-sm text-center theme-text-secondary py-4">
                                            Aucun autre participant n'a fait de pronostic sur ce match
                                          </p>
                                        ) : (
                                          allPlayersPredictions[match.id].map((playerPred, idx) => (
                                            <div
                                              key={`${match.id}-${playerPred.username}-${idx}`}
                                              className="grid items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                                              style={{ backgroundColor: 'var(--background)', gridTemplateColumns: 'auto 1fr auto 1fr 192px' }}
                                            >
                                              {/* Nom du joueur avec avatar à gauche */}
                                              <div className="flex items-center gap-2">
                                                <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900]">
                                                  <Image
                                                    src={getAvatarUrl(playerPred.avatar || 'avatar1')}
                                                    alt={playerPred.username}
                                                    fill
                                                    className="object-cover"
                                                    sizes="32px"
                                                  />
                                                </div>
                                                <span className="theme-text font-medium whitespace-nowrap">{playerPred.username}</span>
                                              </div>

                                              {/* Espace flexible */}
                                              <div></div>

                                              {/* Pronostic centré - aligné avec la zone centrale du match */}
                                              <div className="flex items-center justify-center">
                                                {playerPred.hasPronostic ? (
                                                  <div className="flex items-center gap-2 px-3 py-1 bg-white rounded">
                                                    <span className="font-bold" style={{ color: '#0f172a' }}>{playerPred.predictedHome}</span>
                                                    <span style={{ color: '#64748b' }}>-</span>
                                                    <span className="font-bold" style={{ color: '#0f172a' }}>{playerPred.predictedAway}</span>
                                                  </div>
                                                ) : (
                                                  <span className="text-sm theme-text-secondary italic">Pas de pronostic</span>
                                                )}
                                              </div>

                                              {/* Espace flexible */}
                                              <div></div>

                                              {/* Points - aligné avec bouton de points */}
                                              <div className="flex items-center justify-end">
                                                {match.finished && match.home_score !== null && match.away_score !== null && playerPred.hasPronostic && (
                                                  <div
                                                    className="w-24 px-4 py-2 rounded-lg font-bold text-sm text-center"
                                                    style={getPointsColorStyle(playerPred.points)}
                                                  >
                                                    {playerPred.points > 0 ? `+${playerPred.points}` : '0'} pts
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
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

          {activeTab === 'classement' && tournament && (
            <TournamentRankings
              tournamentId={tournament.id}
              availableMatchdays={availableMatchdays}
              tournamentName={tournament.name}
              allMatches={allMatches}
            />
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
