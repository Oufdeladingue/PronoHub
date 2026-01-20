'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import Navigation from '@/components/Navigation'
import TournamentRankings from '@/components/TournamentRankings'
import TournamentChat from '@/components/TournamentChat'
import { getAvatarUrl } from '@/lib/avatars'
import { getStageShortLabel, type StageType } from '@/lib/stage-formatter'
import { translateTeamName } from '@/lib/translations'
import Footer from '@/components/Footer'
import { DurationExtensionBanner } from '@/components/DurationExtensionBanner'

interface Tournament {
  id: string
  name: string
  slug: string
  competition_id: number | null
  custom_competition_id?: string | null
  competition_name: string
  max_players: number
  status: string
  num_matchdays?: number
  all_matchdays?: boolean
  starting_matchday?: number
  ending_matchday?: number
  scoring_default_prediction_max?: number
  start_date?: string // Date de lancement du tournoi (passage en status 'active')
  bonus_match?: boolean
  tournament_type?: string
  teams_enabled?: boolean
  early_prediction_bonus?: boolean
}

interface Match {
  id: string
  matchday: number
  stage?: StageType | null
  utc_date: string
  home_team_name: string
  away_team_name: string
  home_team_crest: string | null
  away_team_crest: string | null
  status?: string
  finished?: boolean
  home_score?: number | null
  away_score?: number | null
  // Champs pour les tournois custom (compétition source du match)
  competition_name?: string | null
  competition_emblem?: string | null
  competition_emblem_white?: string | null
}

interface Prediction {
  match_id: string
  predicted_home_score: number | null
  predicted_away_score: number | null
  is_default_prediction?: boolean
}

// Helper function pour déterminer si un match est terminé
const isMatchFinished = (match: Match): boolean => {
  return match.status === 'FINISHED' || match.finished === true
}

export default function OppositionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tournamentSlug = params.tournamentSlug as string

  // Lire le paramètre ?tab= de l'URL pour déterminer l'onglet initial
  const tabParam = searchParams.get('tab')
  const validTabs = ['pronostics', 'classement', 'equipes', 'regles', 'tchat'] as const
  const initialTab = tabParam && validTabs.includes(tabParam as any)
    ? (tabParam as 'pronostics' | 'classement' | 'equipes' | 'regles' | 'tchat')
    : 'pronostics'

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [competitionLogo, setCompetitionLogo] = useState<string | null>(null)
  const [competitionLogoWhite, setCompetitionLogoWhite] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pronostics' | 'classement' | 'equipes' | 'regles' | 'tchat'>(initialTab)
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
  const [matchdayStages, setMatchdayStages] = useState<Record<number, StageType | null>>({}) // Stocker le stage de chaque journée
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [allMatches, setAllMatches] = useState<Match[]>([]) // Tous les matchs du tournoi pour calculer les statuts
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [allPredictions, setAllPredictions] = useState<Record<string, Prediction>>({}) // Toutes les prédictions de l'utilisateur pour tous les matchs
  const [savingPrediction, setSavingPrediction] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [savedPredictions, setSavedPredictions] = useState<Record<string, boolean>>({}) // Suivi des pronos sauvegardés
  const [modifiedPredictions, setModifiedPredictions] = useState<Record<string, boolean>>({}) // Suivi des pronos modifiés
  const [lockedPredictions, setLockedPredictions] = useState<Record<string, boolean>>({}) // Suivi des pronos verrouillés
  const [loadingMatches, setLoadingMatches] = useState(true) // Loader lors du changement de journée (true par défaut pour éviter flash "aucun match")

  // États pour le classement
  const [rankingsView, setRankingsView] = useState<'general' | number>('general')
  const [rankings, setRankings] = useState<any[]>([])
  const [loadingRankings, setLoadingRankings] = useState(false)

  // États pour les matchs bonus
  const [bonusMatchIds, setBonusMatchIds] = useState<Set<string>>(new Set())

  // État pour les points gagnés par match
  const [matchPoints, setMatchPoints] = useState<Record<string, number>>({})

  // État pour les pronostics par défaut (virtuels, non en base)
  const [defaultPredictions, setDefaultPredictions] = useState<Record<string, boolean>>({})

  // État pour les points totaux de la journée
  const [matchdayTotalPoints, setMatchdayTotalPoints] = useState<number>(0)

  // État pour savoir si le bonus d'avant-match a été obtenu pour cette journée
  const [hasEarlyBonus, setHasEarlyBonus] = useState<boolean>(false)

  // États pour les accordéons de pronostics des autres
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())
  const [allPlayersPredictions, setAllPlayersPredictions] = useState<Record<string, any[]>>({})

  // État pour le compteur de messages non lus
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0)

  // États pour les équipes
  interface TeamMember {
    id: string
    userId: string
    username: string
    avatar: string
  }
  interface Team {
    id: string
    name: string
    avatar: string
    members: TeamMember[]
  }
  const [teams, setTeams] = useState<Team[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Ref et états pour la navigation des journées avec flèches
  const matchdaysContainerRef = useRef<HTMLDivElement>(null)
  const matchdayButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // États pour l'extension des journées (tournois custom non free-kick)
  const [canExtendMatchdays, setCanExtendMatchdays] = useState(false)
  const [availableToAdd, setAvailableToAdd] = useState(0)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [matchdaysToAdd, setMatchdaysToAdd] = useState(1)
  const [extendLoading, setExtendLoading] = useState(false)

  // État pour le pseudo du capitaine
  const [captainUsername, setCaptainUsername] = useState<string | null>(null)

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  useEffect(() => {
    // Lancer les 3 requêtes en parallèle pour un chargement plus rapide
    Promise.all([
      fetchCurrentUser(),
      fetchTournamentData(),
      fetchPointsSettings()
    ])
  }, [tournamentSlug])

  // Charger le compteur de messages non lus au chargement et quand le tournoi change
  useEffect(() => {
    if (tournament?.id) {
      fetchUnreadMessagesCount()
    }
  }, [tournament?.id])

  // Charger les équipes si le mode équipe est activé et le tournoi est lancé
  useEffect(() => {
    if (tournament?.id && tournament?.teams_enabled && tournament?.status === 'active') {
      fetchTeams()
    }
  }, [tournament?.id, tournament?.teams_enabled, tournament?.status])

  // Vérifier si le tournoi peut être étendu (tournois custom non free-kick uniquement)
  useEffect(() => {
    if (tournament?.id && tournament?.custom_competition_id && tournament?.status === 'active') {
      checkExtendMatchdays()
    }
  }, [tournament?.id, tournament?.custom_competition_id, tournament?.status, userId])

  useEffect(() => {
    if (tournament?.competition_id || tournament?.custom_competition_id) {
      fetchCompetitionLogo()
      fetchAllMatches() // Charger d'abord tous les matchs
      fetchBonusMatches()
    }
  }, [tournament?.competition_id, tournament?.custom_competition_id])

  // Recalculer les journées disponibles et charger les prédictions une fois que allMatches est chargé
  useEffect(() => {
    if (tournament && allMatches.length > 0) {
      // Lancer les deux en parallèle
      Promise.all([
        fetchAvailableMatchdays(),
        fetchAllUserPredictions()
      ])
    }
  }, [tournament, allMatches.length])

  useEffect(() => {
    if (selectedMatchday !== null && tournament) {
      // Activer le loader lors du changement de journée
      setLoadingMatches(true)

      // Charger les données en parallèle pour un chargement plus rapide
      const loadData = async () => {
        try {
          await Promise.all([
            fetchUserPredictions(),
            fetchMatches(),
            fetchMatchPoints()
          ])
        } finally {
          setLoadingMatches(false)
        }
      }
      loadData()
    }
  }, [selectedMatchday, tournament])

  // Précharger les pronostics de tous les adversaires quand la journée est clôturée
  useEffect(() => {
    // Ne précharger que si :
    // - Les matchs sont chargés (loadingMatches = false)
    // - Il y a des matchs
    // - L'utilisateur est connecté
    // - Les pronostics sont clôturés (30min avant le premier match)
    if (!loadingMatches && matches.length > 0 && userId && tournament) {
      // Vérifier si les pronostics sont clôturés
      const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
      const closingTime = new Date(firstMatchTime.getTime() - 30 * 60 * 1000)
      const isClosed = new Date() >= closingTime

      if (isClosed) {
        // Précharger les pronostics pour tous les matchs en arrière-plan
        preloadMatchdayPredictions(matches)
      }
    }
  }, [loadingMatches, matches.length, userId, tournament?.id])

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

      // Lancer en parallèle : nom de la compétition + pseudo du capitaine
      const [competitionName, captainProfile] = await Promise.all([
        // Requête compétition
        (async () => {
          if (tournamentData.custom_competition_id) {
            const { data: customCompData } = await supabase
              .from('custom_competitions')
              .select('name')
              .eq('id', tournamentData.custom_competition_id)
              .single()
            return customCompData?.name || 'Compétition Custom'
          } else if (tournamentData.competition_id) {
            const { data: competitionData } = await supabase
              .from('competitions')
              .select('name')
              .eq('id', tournamentData.competition_id)
              .single()
            return competitionData?.name || 'Compétition'
          }
          return 'Compétition'
        })(),
        // Requête capitaine
        (async () => {
          if (tournamentData.creator_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', tournamentData.creator_id)
              .single()
            return profile
          }
          return null
        })()
      ])

      setTournament({
        ...tournamentData,
        competition_name: competitionName
      })

      if (captainProfile?.username) {
        setCaptainUsername(captainProfile.username)
      }
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

  const fetchUnreadMessagesCount = async () => {
    if (!tournament?.id) return

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/unread-messages`)
      if (!response.ok) {
        // Si la table n'existe pas encore, on ignore silencieusement
        console.log('Message read status table not yet created')
        return
      }

      const data = await response.json()
      setUnreadMessagesCount(data.unreadCount || 0)
    } catch (err) {
      // Erreur silencieuse en attendant la migration
      console.log('Unread messages feature not yet activated')
    }
  }

  const fetchTeams = async () => {
    if (!tournament?.id) return

    setLoadingTeams(true)
    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/teams`)
      if (!response.ok) {
        console.log('Error fetching teams')
        return
      }

      const data = await response.json()
      if (data.success) {
        setTeams(data.teams || [])
      }
    } catch (err) {
      console.log('Error fetching teams:', err)
    } finally {
      setLoadingTeams(false)
    }
  }

  // Vérifier si le tournoi peut être étendu (capitaine uniquement, tournoi custom non free-kick)
  const checkExtendMatchdays = async () => {
    if (!tournament?.id || !userId) return

    try {
      const response = await fetch(`/api/tournaments/extend-matchdays?tournamentId=${tournament.id}`)
      if (!response.ok) return

      const data = await response.json()
      if (data.success && data.canExtend) {
        setCanExtendMatchdays(true)
        setAvailableToAdd(data.availableToAdd || 0)
      } else {
        setCanExtendMatchdays(false)
        setAvailableToAdd(0)
      }
    } catch (err) {
      console.error('Error checking extend matchdays:', err)
    }
  }

  // Étendre le tournoi avec le nombre de journées choisi
  const extendTournament = async () => {
    if (!tournament?.id || matchdaysToAdd < 1) return

    setExtendLoading(true)
    try {
      const response = await fetch('/api/tournaments/extend-matchdays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          additionalMatchdays: matchdaysToAdd
        })
      })

      const data = await response.json()
      if (data.success) {
        // Fermer la modal et rafraîchir les données
        setShowExtendModal(false)
        setMatchdaysToAdd(1)
        // Recharger les données du tournoi et les journées
        window.location.reload()
      } else {
        alert(data.error || 'Erreur lors de l\'extension du tournoi')
      }
    } catch (err) {
      console.error('Error extending tournament:', err)
      alert('Erreur lors de l\'extension du tournoi')
    } finally {
      setExtendLoading(false)
    }
  }

  const markMessagesAsRead = async () => {
    if (!tournament?.id) return

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/messages`, {
        method: 'PUT'
      })
      if (!response.ok) {
        // Si la table n'existe pas encore, on ignore silencieusement
        console.log('Message read status table not yet created')
        return
      }

      // Réinitialiser le compteur à 0
      setUnreadMessagesCount(0)
    } catch (err) {
      // Erreur silencieuse en attendant la migration
      console.log('Unread messages feature not yet activated')
    }
  }

  const handleCauserieClick = () => {
    setActiveTab('tchat')
    markMessagesAsRead()
  }

  const fetchCompetitionLogo = async () => {
    try {
      const supabase = createClient()

      if (tournament?.custom_competition_id) {
        // Compétition custom
        const { data, error } = await supabase
          .from('custom_competitions')
          .select('custom_emblem_white, custom_emblem_color')
          .eq('id', tournament.custom_competition_id)
          .single()

        if (error) throw error
        if (data?.custom_emblem_white) {
          setCompetitionLogo(data.custom_emblem_white)
          setCompetitionLogoWhite(data.custom_emblem_white)
        }
      } else if (tournament?.competition_id) {
        // Compétition importée
        const { data, error } = await supabase
          .from('competitions')
          .select('emblem, custom_emblem_white')
          .eq('id', tournament.competition_id)
          .single()

        if (error) throw error
        if (data?.emblem) {
          setCompetitionLogo(data.emblem)
        }
        if (data?.custom_emblem_white) {
          setCompetitionLogoWhite(data.custom_emblem_white)
        }
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
      let firstMatchTime: Date | null = null

      if (tournament.custom_competition_id) {
        // Compétition custom
        const { data: matchdayData } = await supabase
          .from('custom_competition_matchdays')
          .select('id')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .eq('matchday_number', matchday)
          .single()

        if (matchdayData) {
          // Récupérer le premier match avec son football_data_match_id
          const { data: customMatch } = await supabase
            .from('custom_competition_matches')
            .select('football_data_match_id, cached_utc_date')
            .eq('custom_matchday_id', matchdayData.id)
            .order('cached_utc_date', { ascending: true })
            .limit(1)
            .single()

          if (customMatch) {
            // Si on a le football_data_match_id, récupérer la date à jour depuis imported_matches
            if (customMatch.football_data_match_id) {
              const { data: importedMatch } = await supabase
                .from('imported_matches')
                .select('utc_date')
                .eq('football_data_match_id', customMatch.football_data_match_id)
                .single()

              if (importedMatch) {
                firstMatchTime = new Date(importedMatch.utc_date)
              } else {
                // Fallback sur le cache
                firstMatchTime = new Date(customMatch.cached_utc_date)
              }
            } else {
              // Fallback sur le cache si pas de football_data_match_id
              firstMatchTime = new Date(customMatch.cached_utc_date)
            }
          }
        }
      } else if (tournament.competition_id) {
        // Compétition importée classique
        const { data: matchesData } = await supabase
          .from('imported_matches')
          .select('utc_date')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', matchday)
          .order('utc_date', { ascending: true })
          .limit(1)

        if (matchesData && matchesData.length > 0) {
          firstMatchTime = new Date(matchesData[0].utc_date)
        }
      }

      if (firstMatchTime) {
        const closingTime = new Date(firstMatchTime.getTime() - 30 * 60 * 1000) // 30min avant
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
      // Ces journées sont calculées correctement lors du lancement (API /start)
      // et incluent uniquement les journées jouables
      const startMatchday = tournament.starting_matchday
      const endMatchday = tournament.ending_matchday

      if (!startMatchday || !endMatchday) {
        console.error('Le tournoi n\'a pas de journées définies')
        return
      }

      // Construire la liste des journées du tournoi
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

      let matchesData: any[] = []

      if (tournament.custom_competition_id) {
        // Compétition custom - récupérer les matchs depuis custom_competition_matches
        // D'abord récupérer les journées pour avoir leurs IDs
        console.log('[fetchAllMatches] Custom competition ID:', tournament.custom_competition_id)
        console.log('[fetchAllMatches] Start matchday:', startMatchday, 'End matchday:', endMatchday)

        const { data: matchdaysData, error: matchdaysError } = await supabase
          .from('custom_competition_matchdays')
          .select('id, matchday_number')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .gte('matchday_number', startMatchday)
          .lte('matchday_number', endMatchday)

        console.log('[fetchAllMatches] Matchdays data:', matchdaysData)
        if (matchdaysError) {
          console.error('[fetchAllMatches] Matchdays error:', matchdaysError)
          throw matchdaysError
        }

        if (matchdaysData && matchdaysData.length > 0) {
          console.log('[fetchAllMatches] Found', matchdaysData.length, 'matchdays')
          const matchdayIds = matchdaysData.map(md => md.id)
          const matchdayNumberMap = matchdaysData.reduce((acc: any, md: any) => {
            acc[md.id] = md.matchday_number
            return acc
          }, {})

          console.log('[fetchAllMatches] Fetching matches for matchday IDs:', matchdayIds)
          // Récupérer les matchs custom avec football_data_match_id pour faire la jointure
          const { data: customMatches, error } = await supabase
            .from('custom_competition_matches')
            .select(`
              id,
              custom_matchday_id,
              football_data_match_id,
              imported_match_id,
              display_order,
              cached_utc_date,
              cached_home_team,
              cached_away_team,
              cached_home_logo,
              cached_away_logo,
              cached_competition_name
            `)
            .in('custom_matchday_id', matchdayIds)
            .order('display_order', { ascending: true })

          console.log('[fetchAllMatches] Custom matches result:', { data: customMatches, error })
          if (error) throw error

          // Récupérer les IDs football_data pour faire la jointure
          const footballDataIds = (customMatches || [])
            .map((m: any) => m.football_data_match_id)
            .filter((id: any) => id !== null)

          // Récupérer les matchs importés via football_data_match_id (ID stable)
          // Inclure la relation avec competitions pour les logos
          // IMPORTANT: On récupère l'id de imported_matches pour les prédictions (FK constraint)
          let importedMatchesMap: Record<number, any> = {}
          if (footballDataIds.length > 0) {
            const { data: importedMatches } = await supabase
              .from('imported_matches')
              .select(`
                id,
                football_data_match_id,
                home_team_name,
                away_team_name,
                home_team_crest,
                away_team_crest,
                utc_date,
                status,
                home_score,
                away_score,
                finished,
                stage,
                competition_id,
                competitions (
                  id,
                  name,
                  emblem,
                  custom_emblem_white,
                  custom_emblem_color
                )
              `)
              .in('football_data_match_id', footballDataIds)

            if (importedMatches) {
              importedMatchesMap = importedMatches.reduce((acc: any, im: any) => {
                acc[im.football_data_match_id] = im
                return acc
              }, {})
            }
          }
          console.log('[fetchAllMatches] Found', Object.keys(importedMatchesMap).length, 'imported matches by football_data_match_id')

          // Transformer les matchs custom au format attendu
          // IMPORTANT: Utiliser l'ID de imported_matches (im.id) comme id du match pour les prédictions
          // car la table predictions a une contrainte FK vers imported_matches.id
          matchesData = (customMatches || []).map((match: any) => {
            const im = importedMatchesMap[match.football_data_match_id]
            const comp = im?.competitions
            return {
              // Utiliser l'ID de imported_matches pour les prédictions (FK constraint)
              id: im?.id || match.id,
              // Garder l'ID custom pour référence si besoin
              custom_match_id: match.id,
              matchday: matchdayNumberMap[match.custom_matchday_id],
              utc_date: im?.utc_date || match.cached_utc_date,
              home_team_name: im?.home_team_name || match.cached_home_team,
              away_team_name: im?.away_team_name || match.cached_away_team,
              home_team_crest: im?.home_team_crest || match.cached_home_logo,
              away_team_crest: im?.away_team_crest || match.cached_away_logo,
              status: im?.status || 'SCHEDULED',
              finished: im?.finished || false,
              home_score: im?.home_score ?? null,
              away_score: im?.away_score ?? null,
              stage: im?.stage || null,
              // Infos de la compétition source pour les tournois custom
              competition_name: comp?.name || match.cached_competition_name || null,
              competition_emblem: comp?.custom_emblem_color || comp?.emblem || null,
              competition_emblem_white: comp?.custom_emblem_white || comp?.emblem || null
            }
          }).sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
          console.log('[fetchAllMatches] Transformed', matchesData.length, 'matches')
        } else {
          console.log('[fetchAllMatches] No matchdays found for custom competition')
        }
      } else if (tournament.competition_id) {
        // Compétition importée classique
        const { data: allMatchesData, error } = await supabase
          .from('imported_matches')
          .select('*')
          .eq('competition_id', tournament.competition_id)
          .gte('matchday', startMatchday)
          .lte('matchday', endMatchday)
          .order('utc_date', { ascending: true })

        if (error) throw error
        matchesData = allMatchesData || []
      }

      setAllMatches(matchesData)

      // Extraire les stages par journée depuis les matchs chargés
      const stagesByMatchday: Record<number, StageType | null> = {}
      matchesData.forEach((match: any) => {
        if (match.matchday && !stagesByMatchday[match.matchday]) {
          stagesByMatchday[match.matchday] = match.stage || null
        }
      })
      console.log('[fetchAllMatches] Stages by matchday:', stagesByMatchday)
      console.log('[fetchAllMatches] Sample match stages:', matchesData.slice(0, 3).map((m: any) => ({ matchday: m.matchday, stage: m.stage })))
      setMatchdayStages(stagesByMatchday)
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
        const bonusIds = new Set<string>(data.bonusMatches.map((bm: any) => bm.match_id))
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
      let matchesData: any[] = []

      if (tournament.custom_competition_id) {
        // Compétition custom - récupérer les matchs depuis custom_competition_matches
        const { data: matchdayData } = await supabase
          .from('custom_competition_matchdays')
          .select('id')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .eq('matchday_number', selectedMatchday)
          .single()

        if (matchdayData) {
          const { data: customMatches, error } = await supabase
            .from('custom_competition_matches')
            .select('id, football_data_match_id, cached_utc_date, cached_home_team, cached_away_team, cached_home_logo, cached_away_logo, display_order')
            .eq('custom_matchday_id', matchdayData.id)
            .order('display_order', { ascending: true })

          if (error) throw error

          // Récupérer les IDs football_data pour faire la jointure
          const footballDataIds = (customMatches || [])
            .map((m: any) => m.football_data_match_id)
            .filter((id: any) => id !== null)

          // Récupérer les matchs importés via football_data_match_id (ID stable)
          // Inclure la relation competitions pour récupérer le logo de la compétition source
          // IMPORTANT: On récupère l'id de imported_matches pour les prédictions (clé étrangère)
          let importedMatchesMap: Record<number, any> = {}
          if (footballDataIds.length > 0) {
            const { data: importedMatches } = await supabase
              .from('imported_matches')
              .select(`
                id, football_data_match_id, home_team_name, away_team_name, home_team_crest, away_team_crest,
                utc_date, status, home_score, away_score, finished, stage, competition_id,
                competitions (id, name, emblem, custom_emblem_white, custom_emblem_color)
              `)
              .in('football_data_match_id', footballDataIds)

            if (importedMatches) {
              importedMatchesMap = importedMatches.reduce((acc: any, im: any) => {
                acc[im.football_data_match_id] = im
                return acc
              }, {})
            }
          }

          // Transformer les matchs custom au format attendu
          // IMPORTANT: Utiliser l'ID de imported_matches (im.id) comme id du match pour les prédictions
          // car la table predictions a une contrainte FK vers imported_matches.id
          matchesData = (customMatches || []).map((match: any) => {
            const im = importedMatchesMap[match.football_data_match_id]
            const comp = im?.competitions
            return {
              // Utiliser l'ID de imported_matches pour les prédictions (FK constraint)
              id: im?.id || match.id,
              // Garder l'ID custom pour référence si besoin
              custom_match_id: match.id,
              matchday: selectedMatchday,
              utc_date: im?.utc_date || match.cached_utc_date,
              home_team_name: im?.home_team_name || match.cached_home_team,
              away_team_name: im?.away_team_name || match.cached_away_team,
              home_team_crest: im?.home_team_crest || match.cached_home_logo,
              away_team_crest: im?.away_team_crest || match.cached_away_logo,
              status: im?.status || 'SCHEDULED',
              finished: im?.finished || false,
              home_score: im?.home_score ?? null,
              away_score: im?.away_score ?? null,
              stage: im?.stage || null,
              // Infos de la compétition source pour les tournois custom
              competition_name: comp?.name || null,
              competition_emblem: comp?.custom_emblem_color || comp?.emblem || null,
              competition_emblem_white: comp?.custom_emblem_white || comp?.emblem || null
            }
          }).sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
        }
      } else if (tournament.competition_id) {
        // Compétition importée classique
        const { data, error } = await supabase
          .from('imported_matches')
          .select('*')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', selectedMatchday)
          .order('utc_date', { ascending: true })

        if (error) throw error
        matchesData = data || []
      }

      setMatches(matchesData)

      // Initialiser les prédictions à 0-0 pour tous les matchs qui n'ont pas encore de prédiction
      if (matchesData.length > 0) {
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

      // Récupérer les IDs des matchs de la journée sélectionnée
      let matchIds: string[] = []

      if (tournament.custom_competition_id) {
        // Compétition custom - récupérer les IDs de imported_matches via football_data_match_id
        const { data: matchdayData } = await supabase
          .from('custom_competition_matchdays')
          .select('id')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .eq('matchday_number', selectedMatchday)
          .single()

        if (matchdayData) {
          // Récupérer les football_data_match_id des matchs custom
          const { data: customMatchesData } = await supabase
            .from('custom_competition_matches')
            .select('football_data_match_id')
            .eq('custom_matchday_id', matchdayData.id)

          const footballDataIds = customMatchesData
            ?.map(m => m.football_data_match_id)
            .filter(id => id !== null) || []

          // Récupérer les IDs de imported_matches correspondants
          if (footballDataIds.length > 0) {
            const { data: importedMatchesData } = await supabase
              .from('imported_matches')
              .select('id')
              .in('football_data_match_id', footballDataIds)

            matchIds = importedMatchesData?.map(m => m.id) || []
          }
        }
      } else if (tournament.competition_id) {
        // Compétition importée classique
        const { data: matchesData } = await supabase
          .from('imported_matches')
          .select('id')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', selectedMatchday)

        matchIds = matchesData?.map(m => m.id) || []
      }

      console.log('🔍 [fetchUserPredictions] Matchs trouvés:', matchIds.length)

      if (matchIds.length === 0) return

      console.log('🔍 [fetchUserPredictions] Match IDs:', matchIds)
      console.log('🔍 [fetchUserPredictions] Tournament ID:', tournament.id)
      console.log('🔍 [fetchUserPredictions] User ID:', user.id)

      // Ensuite, récupérer les prédictions pour ces matchs
      const { data: predictionsData, error } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      console.log('🔍 [fetchUserPredictions] Predictions query error:', error)
      console.log('🔍 [fetchUserPredictions] Predictions found:', predictionsData?.length || 0)

      if (error) {
        console.error('Erreur Supabase:', error)
        throw error
      }

      // Convertir en objet pour un accès rapide
      const predictionsMap: Record<string, Prediction> = {}
      const savedMap: Record<string, boolean> = {}
      const lockedMap: Record<string, boolean> = {}
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

  const fetchAllUserPredictions = async () => {
    try {
      if (!tournament || !allMatches.length) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Récupérer les IDs de tous les matchs du tournoi
      const matchIds = allMatches.map(m => m.id)

      if (matchIds.length === 0) return

      // Récupérer toutes les prédictions de l'utilisateur pour ces matchs
      const { data: predictionsData, error } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      if (error) {
        console.error('Erreur lors du chargement de toutes les prédictions:', error)
        return
      }

      // Convertir en objet pour un accès rapide
      const predictionsMap: Record<string, Prediction> = {}
      predictionsData?.forEach(pred => {
        predictionsMap[pred.match_id] = pred
      })

      setAllPredictions(predictionsMap)
    } catch (err) {
      console.error('Erreur lors du chargement de toutes les prédictions:', err)
    }
  }

  const fetchMatchPoints = async () => {
    try {
      if (!tournament || selectedMatchday === null) return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Récupérer les matchs avec scores de cette journée (terminés ou en cours)
      let matchesData: any[] = []
      const isCustomCompetition = !!tournament.custom_competition_id

      if (isCustomCompetition) {
        // Compétition custom - récupérer les matchs via custom_competition_matches
        const { data: matchdayData } = await supabase
          .from('custom_competition_matchdays')
          .select('id')
          .eq('custom_competition_id', tournament.custom_competition_id)
          .eq('matchday_number', selectedMatchday)
          .single()

        if (matchdayData) {
          const { data: customMatches } = await supabase
            .from('custom_competition_matches')
            .select('id, football_data_match_id, cached_utc_date')
            .eq('custom_matchday_id', matchdayData.id)

          if (customMatches && customMatches.length > 0) {
            const footballDataIds = customMatches
              .map(m => m.football_data_match_id)
              .filter(id => id !== null)

            if (footballDataIds.length > 0) {
              const { data: importedMatches } = await supabase
                .from('imported_matches')
                .select('id, football_data_match_id, home_score, away_score, finished, status, utc_date')
                .in('football_data_match_id', footballDataIds)
                .not('home_score', 'is', null)

              matchesData = importedMatches || []
            }
          }
        }
      } else {
        // Compétition standard
        const { data } = await supabase
          .from('imported_matches')
          .select('id, home_score, away_score, finished, status, utc_date')
          .eq('competition_id', tournament.competition_id)
          .eq('matchday', selectedMatchday)
          .not('home_score', 'is', null)

        matchesData = data || []
      }

      if (!matchesData || matchesData.length === 0) return

      const matchIds = matchesData.map(m => m.id)

      // Récupérer les pronostics de l'utilisateur pour ces matchs (avec created_at pour le bonus)
      const { data: predictionsData } = await supabase
        .from('predictions')
        .select('match_id, predicted_home_score, predicted_away_score, is_default_prediction, created_at')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .in('match_id', matchIds)

      // Créer une map des pronostics existants
      const predictionsMap = new Map(predictionsData?.map(p => [p.match_id, p]) || [])

      // Récupérer les matchs bonus
      const isBonusMatch = (matchId: string) => bonusMatchIds.has(matchId)

      // Calculer les points pour chaque match (y compris les pronostics par défaut)
      const pointsMap: Record<string, number> = {}
      const defaultMap: Record<string, boolean> = {}

      for (const match of matchesData) {
        if (match.home_score === null || match.away_score === null) continue

        // Vérifier si le match a commencé (pour appliquer le pronostic par défaut)
        const matchHasStarted = new Date(match.utc_date) <= new Date()
        const matchIsFinished = match.status === 'FINISHED' || match.finished === true

        // Récupérer le pronostic existant ou créer un pronostic par défaut virtuel
        const existingPrediction = predictionsMap.get(match.id)
        const hasPrediction = existingPrediction &&
          existingPrediction.predicted_home_score !== null &&
          existingPrediction.predicted_away_score !== null

        // Si pas de pronostic et que le match a commencé/est terminé, appliquer le défaut 0-0
        const shouldApplyDefault = !hasPrediction && (matchHasStarted || matchIsFinished)

        const prediction = hasPrediction
          ? existingPrediction
          : shouldApplyDefault
            ? {
                match_id: match.id,
                predicted_home_score: 0,
                predicted_away_score: 0,
                is_default_prediction: true
              }
            : null

        if (!prediction) continue

        const pred_home = prediction.predicted_home_score
        const pred_away = prediction.predicted_away_score

        if (pred_home === null || pred_away === null) continue

        // Calculer les points
        const isExact = pred_home === match.home_score && pred_away === match.away_score
        const predOutcome = pred_home > pred_away ? 'H' : (pred_home < pred_away ? 'A' : 'D')
        const realOutcome = match.home_score > match.away_score ? 'H' : (match.home_score < match.away_score ? 'A' : 'D')
        const isCorrect = predOutcome === realOutcome

        let points = 0
        const isDefaultPrediction = prediction.is_default_prediction || shouldApplyDefault

        // Tracker si c'est un pronostic par défaut
        if (isDefaultPrediction) {
          defaultMap[match.id] = true
        }

        // Si c'est un pronostic par défaut (0-0) et que c'est un match nul, seulement 1 point
        if (isDefaultPrediction && realOutcome === 'D') {
          points = 1
        } else if (isDefaultPrediction) {
          // Si c'est un pronostic par défaut mais pas un match nul, 0 point
          points = 0
        } else {
          // Pronostic normal
          if (isExact) {
            points = pointsSettings.exactScore
          } else if (isCorrect) {
            points = pointsSettings.correctResult
          } else {
            points = pointsSettings.incorrectResult
          }

          // Doubler si match bonus (seulement pour les vrais pronostics)
          if (isBonusMatch(match.id)) {
            points *= 2
          }
        }

        pointsMap[match.id] = points
      }

      setMatchPoints(pointsMap)
      setDefaultPredictions(defaultMap)

      // Calculer le total des points pour cette journée
      let totalPoints = Object.values(pointsMap).reduce((sum, pts) => sum + pts, 0)

      // Calculer le bonus "Prime d'avant-match" si activé
      // +1 point si TOUS les pronostics ont été faits avant le premier match de la journée
      if (tournament.early_prediction_bonus && matchesData.length > 0 && predictionsData) {
        // Trouver l'heure du premier match
        const firstMatchTime = matchesData.reduce((earliest, match) => {
          const matchDate = new Date(match.utc_date)
          return !earliest || matchDate < earliest ? matchDate : earliest
        }, null as Date | null)

        if (firstMatchTime) {
          // Vérifier si tous les pronostics ont été faits avant le premier match
          let allPredictionsOnTime = true

          for (const matchId of matchIds) {
            const prediction = predictionsData.find((p: any) => p.match_id === matchId)

            // Si pas de pronostic du tout, ou si c'est un pronostic par défaut, pas de bonus
            if (!prediction || prediction.is_default_prediction) {
              allPredictionsOnTime = false
              break
            }

            // Si le pronostic a été fait après le premier match, pas de bonus
            if (prediction.created_at) {
              const predCreatedAt = new Date(prediction.created_at)
              if (predCreatedAt >= firstMatchTime) {
                allPredictionsOnTime = false
                break
              }
            }
          }

          // Ajouter +1 point si tous les pronostics ont été faits à temps
          if (allPredictionsOnTime) {
            totalPoints += 1
            setHasEarlyBonus(true)
            console.log('[fetchMatchPoints] Bonus prime d\'avant-match: +1 point')
          } else {
            setHasEarlyBonus(false)
          }
        }
      } else {
        setHasEarlyBonus(false)
      }

      setMatchdayTotalPoints(totalPoints)
    } catch (err) {
      console.error('Erreur lors du chargement des points:', err)
    }
  }

  // Fonction pour récupérer les pronostics de tous les participants pour un match
  const fetchAllPlayersPredictionsForMatch = async (matchId: string, match: Match) => {
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
              isDefaultPrediction: false,
              hasPronostic: false,
              points: 0,
              isExact: false,
              isCorrect: false
            }
          }

          // Calculer les points si le match a un score (terminé ou en cours)
          let points = 0
          let isExact = false
          let isCorrect = false

          if (match.home_score !== null && match.home_score !== undefined && match.away_score !== null && match.away_score !== undefined) {
            const homeScore = match.home_score
            const awayScore = match.away_score
            // Gérer les pronostics par défaut
            if (prediction.is_default_prediction) {
              // Pronostic par défaut : seulement 1 point si match nul
              const realOutcome = homeScore > awayScore ? 'H' : (homeScore < awayScore ? 'A' : 'D')
              if (realOutcome === 'D') {
                points = 1
                isCorrect = true
              }
            } else {
              // Pronostic normal
              isExact = prediction.predicted_home_score === homeScore && prediction.predicted_away_score === awayScore
              const predOutcome = prediction.predicted_home_score > prediction.predicted_away_score ? 'H' : (prediction.predicted_home_score < prediction.predicted_away_score ? 'A' : 'D')
              const realOutcome = homeScore > awayScore ? 'H' : (homeScore < awayScore ? 'A' : 'D')
              isCorrect = predOutcome === realOutcome

              if (isExact) {
                points = pointsSettings.exactScore
              } else if (isCorrect) {
                points = pointsSettings.correctResult
              } else {
                points = pointsSettings.incorrectResult
              }

              // Doubler si match bonus (seulement pour les vrais pronostics)
              if (bonusMatchIds.has(matchId)) {
                points *= 2
              }
            }
          }

          return {
            username,
            avatar: prediction.avatar || 'avatar1',
            predictedHome: prediction.predicted_home_score,
            predictedAway: prediction.predicted_away_score,
            isDefaultPrediction: prediction.is_default_prediction || false,
            hasPronostic: true,
            points,
            isExact,
            isCorrect
          }
        })
        // Pas de tri ici : on garde l'ordre d'inscription retourné par l'API

      setAllPlayersPredictions(prev => ({
        ...prev,
        [matchId]: playersPredictions
      }))
    } catch (err) {
      console.error('Erreur lors du chargement des pronostics des autres:', err)
    }
  }

  // Fonction pour précharger TOUS les pronostics d'une journée en une seule requête
  const preloadMatchdayPredictions = async (matchesToPreload: Match[]) => {
    try {
      if (!tournament || !userId || matchesToPreload.length === 0) return

      // Récupérer les IDs de tous les matchs
      const matchIds = matchesToPreload.map(m => m.id).join(',')

      // Appeler l'API batch
      const response = await fetch(
        `/api/tournaments/${tournament.id}/matchday-predictions?matchIds=${matchIds}`
      )

      if (!response.ok) {
        throw new Error('Erreur lors du préchargement des pronostics')
      }

      const data = await response.json()
      const allPredictionsByMatch = data.predictions

      if (!allPredictionsByMatch) return

      // Créer un Map des matchs pour accéder aux scores rapidement
      const matchesMap = new Map(matchesToPreload.map(m => [m.id, m]))

      // Transformer et stocker les pronostics pour chaque match
      const processedPredictions: Record<string, any[]> = {}

      for (const matchId of Object.keys(allPredictionsByMatch)) {
        const predictions = allPredictionsByMatch[matchId]
        const match = matchesMap.get(matchId)

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
                isDefaultPrediction: false,
                hasPronostic: false,
                points: 0,
                isExact: false,
                isCorrect: false
              }
            }

            // Calculer les points si le match a un score
            let points = 0
            let isExact = false
            let isCorrect = false

            if (match && match.home_score !== null && match.home_score !== undefined &&
                match.away_score !== null && match.away_score !== undefined) {
              const homeScore = match.home_score
              const awayScore = match.away_score

              if (prediction.is_default_prediction) {
                const realOutcome = homeScore > awayScore ? 'H' : (homeScore < awayScore ? 'A' : 'D')
                if (realOutcome === 'D') {
                  points = 1
                  isCorrect = true
                }
              } else {
                isExact = prediction.predicted_home_score === homeScore && prediction.predicted_away_score === awayScore
                const predOutcome = prediction.predicted_home_score > prediction.predicted_away_score ? 'H' :
                  (prediction.predicted_home_score < prediction.predicted_away_score ? 'A' : 'D')
                const realOutcome = homeScore > awayScore ? 'H' : (homeScore < awayScore ? 'A' : 'D')
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
            }

            return {
              username,
              avatar: prediction.avatar || 'avatar1',
              predictedHome: prediction.predicted_home_score,
              predictedAway: prediction.predicted_away_score,
              isDefaultPrediction: prediction.is_default_prediction || false,
              hasPronostic: true,
              points,
              isExact,
              isCorrect
            }
          })

        processedPredictions[matchId] = playersPredictions
      }

      // Mettre à jour l'état en une seule fois
      setAllPlayersPredictions(prev => ({
        ...prev,
        ...processedPredictions
      }))
    } catch (err) {
      console.error('Erreur lors du préchargement des pronostics:', err)
    }
  }

  // Fonction pour toggle l'accordéon
  const toggleMatchExpansion = async (matchId: string, match: Match) => {
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

  const handleScoreChange = (matchId: string, team: 'home' | 'away', value: number) => {
    setPredictions(prev => {
      const currentPrediction = prev[matchId]
      // Si on modifie un score, initialiser l'autre à 0 s'il est null (pour éviter les erreurs de validation)
      const currentHomeScore = currentPrediction?.predicted_home_score
      const currentAwayScore = currentPrediction?.predicted_away_score

      return {
        ...prev,
        [matchId]: {
          match_id: matchId,
          predicted_home_score: team === 'home' ? value : (currentHomeScore ?? 0),
          predicted_away_score: team === 'away' ? value : (currentAwayScore ?? 0)
        }
      }
    })
    // Marquer comme modifié si déjà sauvegardé
    if (savedPredictions[matchId]) {
      setModifiedPredictions(prev => ({ ...prev, [matchId]: true }))
    }
    // Marquer comme "en attente d'enregistrement" (pour déclencher l'animation pulse)
    setModifiedPredictions(prev => ({ ...prev, [matchId]: true }))
  }

  const unlockPrediction = (matchId: string) => {
    setLockedPredictions(prev => ({ ...prev, [matchId]: false }))
    // Marquer comme modifié pour réafficher les boutons +/-
    setModifiedPredictions(prev => ({ ...prev, [matchId]: true }))
  }

  const savePrediction = async (matchId: string) => {
    try {
      setSavingPrediction(matchId)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user || !tournament) return

      const prediction = predictions[matchId]
      if (!prediction || prediction.predicted_home_score === null || prediction.predicted_home_score === undefined ||
          prediction.predicted_away_score === null || prediction.predicted_away_score === undefined) {
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

      // Mettre à jour également allPredictions pour que les avertissements se mettent à jour
      setAllPredictions(prev => ({ ...prev, [matchId]: prediction }))

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

    // Vérifier si la journée est en cours (30min avant le premier match ou après)
    const firstMatchTime = new Date(Math.min(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursUntilFirstMatch = (firstMatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilFirstMatch < 0.5) {
      return 'En cours'
    }

    return 'À venir'
  }

  // Déterminer si une journée nécessite un avertissement (pronostics manquants et éditables)
  const shouldShowMatchdayWarning = (matchday: number): boolean => {
    if (!allMatches.length || !userId) return false

    // Récupérer les matchs de cette journée
    const matchdayMatches = allMatches.filter(m => m.matchday === matchday)
    if (matchdayMatches.length === 0) return false

    const now = new Date()

    // Récupérer le premier match de la journée
    const firstMatchTime = new Date(Math.min(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursUntilFirstMatch = (firstMatchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Vérifier si la journée a commencé ou commence dans moins de 48h
    const journeyStartedOrSoon = hoursUntilFirstMatch < 48

    if (!journeyStartedOrSoon) return false

    // Vérifier si la journée est terminée
    const lastMatchTime = new Date(Math.max(...matchdayMatches.map(m => new Date(m.utc_date).getTime())))
    const hoursAfterLastMatch = (now.getTime() - lastMatchTime.getTime()) / (1000 * 60 * 60)
    const isFinished = hoursAfterLastMatch > 2

    if (isFinished) return false

    // Vérifier s'il reste des pronostics manquants et éditables
    let hasMissingEditablePredictions = false

    for (const match of matchdayMatches) {
      const matchTime = new Date(match.utc_date)
      const hoursBeforeMatch = (matchTime.getTime() - now.getTime()) / (1000 * 60 * 60)

      // Le match est encore éditable (plus d'30min avant le match)
      const isEditable = hoursBeforeMatch > 0.5

      if (!isEditable) continue

      // Vérifier si l'utilisateur a un pronostic pour ce match
      const userPrediction = allPredictions[match.id]
      const hasPrediction = userPrediction &&
        userPrediction.predicted_home_score !== null &&
        userPrediction.predicted_away_score !== null

      if (!hasPrediction) {
        hasMissingEditablePredictions = true
        break
      }
    }

    return hasMissingEditablePredictions
  }

  // Fonctions pour la navigation des journées avec flèches
  const checkScrollButtons = useCallback(() => {
    const container = matchdaysContainerRef.current
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0)
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
    }
  }, [])

  const scrollMatchdays = useCallback((direction: 'left' | 'right') => {
    const container = matchdaysContainerRef.current
    if (container) {
      const scrollAmount = 200 // Pixels à scroller
      const newScrollLeft = direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' })
    }
  }, [])

  // Vérifier les boutons de scroll au chargement et au resize
  useEffect(() => {
    checkScrollButtons()
    window.addEventListener('resize', checkScrollButtons)
    return () => window.removeEventListener('resize', checkScrollButtons)
  }, [checkScrollButtons, availableMatchdays])

  // Centrer la journée sélectionnée dans le conteneur de navigation
  useEffect(() => {
    if (selectedMatchday === null) return

    const container = matchdaysContainerRef.current
    const button = matchdayButtonRefs.current[selectedMatchday]

    if (container && button) {
      // Calculer la position pour centrer le bouton
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()

      // Position du bouton par rapport au conteneur
      const buttonLeftInContainer = button.offsetLeft
      const buttonCenter = buttonLeftInContainer + button.offsetWidth / 2
      const containerCenter = container.offsetWidth / 2

      // Scroll pour centrer le bouton
      const scrollTarget = buttonCenter - containerCenter

      container.scrollTo({
        left: scrollTarget,
        behavior: 'smooth'
      })
    }
  }, [selectedMatchday, availableMatchdays])

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

  // Vérifier si un match spécifique est verrouillé (30min avant son coup d'envoi)
  const isMatchLocked = (match: Match) => {
    const matchTime = new Date(match.utc_date)
    const lockTime = new Date(matchTime.getTime() - 30 * 60 * 1000) // 30min avant
    return new Date() >= lockTime
  }

  // Vérifier si un match a commencé (au moment du coup d'envoi)
  const hasMatchStarted = (match: Match) => {
    const matchTime = new Date(match.utc_date)
    return new Date() >= matchTime
  }

  // Vérifier si les pronostics sont clôturés (30min avant le premier match) - Pour compatibilité
  const arePronosticsClosed = () => {
    if (matches.length === 0) return false
    const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
    const closingTime = new Date(firstMatchTime.getTime() - 30 * 60 * 1000)
    return new Date() >= closingTime
  }

  // Vérifier si le premier match a commencé
  const hasFirstMatchStarted = () => {
    if (matches.length === 0) return false
    const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
    return new Date() >= firstMatchTime
  }

  // Vérifier si le dernier match est terminé (plus de 2h après)
  const hasLastMatchEnded = () => {
    if (matches.length === 0) return false
    const lastMatchTime = new Date(Math.max(...matches.map(m => new Date(m.utc_date).getTime())))
    const twoHoursAfter = new Date(lastMatchTime.getTime() + 2 * 60 * 60 * 1000)
    return new Date() >= twoHoursAfter
  }

  // Calculer le temps restant avant la clôture des pronostics (30min avant le 1er match)
  const calculateTimeRemaining = () => {
    if (matches.length === 0) return ''

    const firstMatchTime = new Date(Math.min(...matches.map(m => new Date(m.utc_date).getTime())))
    const closingTime = new Date(firstMatchTime.getTime() - 30 * 60 * 1000) // 30 minutes avant
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

  // Écouter les nouveaux messages en temps réel pour mettre à jour le compteur
  useEffect(() => {
    if (!tournament?.id || activeTab === 'tchat') return

    const supabase = createClient()
    const channel = supabase
      .channel(`tournament-${tournament.id}-unread-messages`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tournament_messages',
          filter: `tournament_id=eq.${tournament.id}`
        },
        (payload) => {
          // Ne pas compter ses propres messages
          if (payload.new.user_id !== userId) {
            setUnreadMessagesCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournament?.id, userId, activeTab])

  // Pas de loader séparé - le NavigationLoader global gère l'affichage pendant la navigation
  // On retourne null pendant le chargement pour éviter le double loader
  if (loading) {
    return null
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
        <Navigation
          username={username}
          userAvatar={userAvatar}
          context="tournament"
          tournamentContext={{
            tournamentName: tournament.name,
            competitionName: tournament.competition_name,
            competitionLogo: competitionLogo,
            competitionLogoWhite: competitionLogoWhite,
            status: "active"
          }}
        />

        {/* Banner d'extension de durée pour les tournois Free-Kick actifs */}
        {tournament.tournament_type === 'free' && tournament.status === 'active' && (
          <div className="max-w-7xl mx-auto px-2 md:px-4">
            <DurationExtensionBanner
              tournamentId={tournament.id}
              tournamentType={tournament.tournament_type}
              tournamentStatus={tournament.status}
            />
          </div>
        )}

        {/* Navigation par onglets */}
        <div className="max-w-7xl mx-auto px-2 md:px-4 mt-3 md:mt-6">
          <div className="flex justify-between md:justify-start md:gap-2 border-b theme-border">
            <button
              onClick={() => setActiveTab('pronostics')}
              className={`nav-tab flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'pronostics'
                  ? 'nav-tab-active theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/prediction.svg"
                alt="Pronostics"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'pronostics'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Pronostics</span>
            </button>
            <button
              onClick={() => setActiveTab('classement')}
              className={`nav-tab flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'classement'
                  ? 'nav-tab-active theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/ranking.svg"
                alt="Classement"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'classement'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Classement</span>
            </button>
            <button
              onClick={handleCauserieClick}
              className={`nav-tab flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'tchat'
                  ? 'nav-tab-active theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              {/* Badge sur l'icône en mobile */}
              <div className="relative md:contents">
                <img
                  src="/images/icons/talk.svg"
                  alt="Causerie"
                  className={`w-7 h-7 md:w-5 md:h-5 ${
                    activeTab === 'tchat'
                      ? 'icon-filter-orange'
                      : 'icon-filter-slate'
                  }`}
                />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1 md:hidden bg-[#ff9900] text-[#0f172a] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </div>
              {/* Badge sur le texte en desktop */}
              <span className="hidden md:inline relative">
                Causerie
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-3 bg-[#ff9900] text-[#0f172a] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </span>
            </button>
            {/* Onglet Équipes - visible uniquement si teams_enabled et tournoi actif */}
            {tournament?.teams_enabled && tournament?.status === 'active' && (
              <button
                onClick={() => setActiveTab('equipes')}
                className={`nav-tab flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                  activeTab === 'equipes'
                    ? 'nav-tab-active theme-accent-text-always border-b-2 border-[#ff9900]'
                    : 'theme-slate-text hover:theme-text'
                }`}
              >
                <img
                  src="/images/icons/team.svg"
                  alt="Équipes"
                  className={`w-7 h-7 md:w-5 md:h-5 ${
                    activeTab === 'equipes'
                      ? 'icon-filter-orange'
                      : 'icon-filter-slate'
                  }`}
                />
                <span className="hidden md:inline">Équipes</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('regles')}
              className={`nav-tab flex-1 md:flex-none px-3 py-2 md:px-6 md:py-3 font-semibold transition-all relative flex items-center justify-center gap-2 ${
                activeTab === 'regles'
                  ? 'nav-tab-active theme-accent-text-always border-b-2 border-[#ff9900]'
                  : 'theme-slate-text hover:theme-text'
              }`}
            >
              <img
                src="/images/icons/rules.svg"
                alt="Règles"
                className={`w-7 h-7 md:w-5 md:h-5 ${
                  activeTab === 'regles'
                    ? 'icon-filter-orange'
                    : 'icon-filter-slate'
                }`}
              />
              <span className="hidden md:inline">Règles</span>
            </button>
          </div>
        </div>

        {/* Contenu des onglets */}
        <main className="max-w-7xl mx-auto px-2 md:px-4 py-4 md:py-8 md:pb-20">
          {activeTab === 'pronostics' && (
            <div className="theme-card">
              {/* Menu de navigation des journées */}
              {availableMatchdays.length > 0 && (
                <div className="mb-6 pb-6 border-b theme-border">
                  <div className="relative flex items-center">
                    {/* Flèche gauche */}
                    {canScrollLeft && (
                      <button
                        onClick={() => scrollMatchdays('left')}
                        className="absolute left-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-r from-slate-800 via-slate-800 to-transparent hover:from-slate-700"
                        aria-label="Journées précédentes"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    )}

                    {/* Container des journées */}
                    <div
                      ref={matchdaysContainerRef}
                      onScroll={checkScrollButtons}
                      className="flex gap-2 overflow-x-auto scrollbar-hide px-1"
                    >
                      {availableMatchdays.map(matchday => {
                        const matchdayStatus = getMatchdayStatus(matchday)
                        const isFinished = matchdayStatus === 'Terminée'
                        const isInProgress = matchdayStatus === 'En cours'
                        const isActive = selectedMatchday === matchday
                        const stage = matchdayStages[matchday]
                        // Vérifier si des matchs existent pour cette journée
                        const hasMatchesForMatchday = allMatches.some((m: any) => m.matchday === matchday)
                        const matchdayLabel = getStageShortLabel(stage, matchday, hasMatchesForMatchday)
                        const showWarning = shouldShowMatchdayWarning(matchday)
                        return (
                          <button
                            key={matchday}
                            ref={(el) => { matchdayButtonRefs.current[matchday] = el }}
                            onClick={() => setSelectedMatchday(matchday)}
                            className={`relative px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold transition-all whitespace-nowrap flex flex-col items-center min-w-[70px] md:min-w-[90px] flex-shrink-0 ${
                              isActive
                                ? 'bg-[#ff9900] text-[#0f172a]'
                                : isFinished
                                  ? 'bg-slate-700 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-600 dark:hover:bg-slate-700'
                                  : 'bg-slate-600 dark:bg-slate-700 text-slate-200 dark:text-slate-300 hover:bg-slate-500 dark:hover:bg-slate-600'
                            }`}
                          >
                            {/* Icône d'avertissement pour pronostics manquants */}
                            {showWarning && (
                              <img
                                src="/images/icons/exclamation.svg"
                                alt="Pronostics manquants"
                                className="absolute top-1 right-1 w-4 h-4 animate-blink-warning"
                                title="Vous avez des pronostics manquants pour cette journée"
                              />
                            )}
                            <span className="text-lg md:text-xl">{matchdayLabel}</span>
                            <span className={`text-[10px] md:text-xs mt-1 font-medium ${
                              isActive
                                ? 'text-[#0f172a]'
                                : isFinished
                                  ? 'text-slate-400 dark:text-slate-500'
                                  : isInProgress
                                    ? 'text-[#ff9900]'
                                    : 'text-slate-300 dark:text-slate-400'
                            }`}>
                              {matchdayStatus}
                            </span>
                          </button>
                        )
                      })}

                      {/* Bouton d'extension du tournoi (capitaine uniquement, tournois custom non free-kick) */}
                      {canExtendMatchdays && availableToAdd > 0 && (
                        <button
                          onClick={() => {
                            setMatchdaysToAdd(1)
                            setShowExtendModal(true)
                          }}
                          className="px-4 py-3 md:px-5 md:py-4 rounded-xl font-bold transition-all whitespace-nowrap flex flex-col items-center min-w-[70px] md:min-w-[90px] flex-shrink-0 bg-green-600 hover:bg-green-500 text-white border-2 border-dashed border-green-400"
                          title="De nouvelles journées sont disponibles"
                        >
                          <span className="text-lg md:text-xl">+{availableToAdd}</span>
                          <span className="text-[10px] md:text-xs mt-1 font-medium text-green-100">
                            Étendre
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Flèche droite */}
                    {canScrollRight && (
                      <button
                        onClick={() => scrollMatchdays('right')}
                        className="absolute right-0 z-10 flex items-center justify-center w-8 h-full bg-gradient-to-l from-slate-800 via-slate-800 to-transparent hover:from-slate-700"
                        aria-label="Journées suivantes"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Liste des matchs */}
              <div>
                {loadingMatches ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
                    <p className="mt-4 theme-text-secondary">Chargement des matchs...</p>
                  </div>
                ) : matches.length === 0 ? (
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
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          <span className="font-semibold text-xs md:text-base">
                            {timeRemaining === 'Pronostics clôturés' ? (
                              <>
                                {hasLastMatchEnded() ? (
                                  /* Journée terminée */
                                  <>
                                    <span className="hidden md:inline">
                                      Journée de compétition terminée : vous avez marqué {matchdayTotalPoints} pts
                                      {hasEarlyBonus && (
                                        <>
                                          {' '}dont{' '}
                                          <button
                                            onClick={() => setActiveTab('regles')}
                                            className="inline-flex items-center gap-0.5 underline hover:text-[#ffaa33] transition-colors"
                                          >
                                            1 de bonus★
                                          </button>
                                        </>
                                      )}
                                    </span>
                                    <span className="md:hidden">
                                      Journée de compétition terminée :<br />vous avez marqué {matchdayTotalPoints} pts
                                      {hasEarlyBonus && (
                                        <>
                                          {' '}dont{' '}
                                          <button
                                            onClick={() => setActiveTab('regles')}
                                            className="inline-flex items-center gap-0.5 underline hover:text-[#ffaa33] transition-colors"
                                          >
                                            1 de bonus★
                                          </button>
                                        </>
                                      )}
                                    </span>
                                  </>
                                ) : hasFirstMatchStarted() ? (
                                  /* Matchs en cours */
                                  <>
                                    <span className="hidden md:inline">
                                      Certains matchs sont en cours ou terminés : vous avez pour le moment marqué {matchdayTotalPoints} pts
                                    </span>
                                    <span className="md:hidden">
                                      Certains matchs sont en cours ou terminés :<br />vous avez pour le moment marqué {matchdayTotalPoints} pts
                                    </span>
                                  </>
                                ) : (
                                  /* Pronostics clôturés mais aucun match commencé (30min avant) */
                                  <>
                                    <span className="hidden md:inline">
                                      Pronostics clôturés : les matchs commencent bientôt
                                    </span>
                                    <span className="md:hidden">
                                      Pronostics clôturés :<br />les matchs commencent bientôt
                                    </span>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <span className="hidden md:inline">Temps restant pour valider vos pronostics : {timeRemaining}</span>
                                <span className="md:hidden">Temps restant pour valider vos pronostics :<br />{timeRemaining}</span>
                              </>
                            )}
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
                            const isClosed = isMatchLocked(match) // Verrouillé 30min avant ce match spécifique
                            const isMatchInProgress = hasMatchStarted(match) // Match a commencé
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
                                className={`relative flex flex-col p-[10px] theme-card hover:shadow-lg transition border-2 ${borderColor} ${isClosed ? 'opacity-75' : ''}`}
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
                                  @keyframes pulse-save {
                                    0%, 100% {
                                      transform: scale(1);
                                      box-shadow: 0 0 0 0 rgba(255, 153, 0, 0.8);
                                    }
                                    50% {
                                      transform: scale(1.08);
                                      box-shadow: 0 0 12px 4px rgba(255, 153, 0, 0.6);
                                    }
                                  }
                                  .animate-pulse-save {
                                    animation: pulse-save 0.8s ease-in-out infinite;
                                    transform-origin: right center;
                                  }
                                `}</style>

                                {/* Affichage MOBILE uniquement */}
                                <div className="md:hidden relative">
                                  {/* Logo de la compétition source en position absolue coin inférieur droit (uniquement pour tournois custom) */}
                                  {tournament?.custom_competition_id && match.competition_emblem && (
                                    <div className="absolute bottom-1 right-1 z-10" title={match.competition_name || ''}>
                                      {/* Logo couleur pour thème clair */}
                                      <img
                                        src={match.competition_emblem}
                                        alt={match.competition_name || 'Compétition'}
                                        className="w-8 h-8 object-contain show-on-light"
                                      />
                                      {/* Logo blanc pour thème sombre */}
                                      <img
                                        src={match.competition_emblem_white || match.competition_emblem}
                                        alt={match.competition_name || 'Compétition'}
                                        className="w-8 h-8 object-contain show-on-dark"
                                      />
                                    </div>
                                  )}
                                  {/* Grille 3 colonnes égales sur mobile */}
                                  <div className="grid grid-cols-3 gap-2 mb-3">
                                    {/* COLONNE 1 - Équipe domicile */}
                                    <div className="flex flex-col items-center gap-1">
                                      {/* Badge bonus en haut si c'est le match bonus - aligné à gauche */}
                                      <div className="w-full flex justify-start mb-1">
                                        {isBonusMatch ? (
                                          <div className="bonus-badge flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded text-[9px] font-bold text-white shadow-lg whitespace-nowrap">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            <span>BONUS</span>
                                          </div>
                                        ) : (
                                          <div className="h-5"></div>
                                        )}
                                      </div>
                                      {/* Logo équipe */}
                                      {match.home_team_crest && (
                                        <img
                                          src={match.home_team_crest}
                                          alt={translateTeamName(match.home_team_name)}
                                          className="w-10 h-10 object-contain flex-shrink-0"
                                        />
                                      )}
                                      {/* Nom équipe */}
                                      <span className="theme-text font-medium text-center text-xs leading-tight">
                                        {translateTeamName(match.home_team_name)}
                                      </span>
                                    </div>

                                    {/* COLONNE 2 - Centre (horaire, score réel, pronostic, points) */}
                                    <div className="flex flex-col items-center gap-1">
                                      {/* Horaire */}
                                      <div className="flex flex-col items-center gap-0.5 mb-1">
                                        <div className="text-xs theme-text-secondary font-semibold">
                                          {matchTime}
                                        </div>
                                      </div>

                                      {/* Badge REPORTÉ si match postponed */}
                                      {match.status === 'POSTPONED' ? (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-orange-600 dark:text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                          </svg>
                                          <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400 uppercase">
                                            Reporté
                                          </span>
                                        </div>
                                      ) : match.home_score !== null && match.away_score !== null && isMatchInProgress ? (
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                                          isMatchFinished(match)
                                            ? 'bg-green-100 dark:bg-green-900/30'
                                            : 'bg-orange-100 dark:bg-orange-900/30 animate-pulse'
                                        }`}>
                                          <span className={`text-[9px] font-semibold ${
                                            isMatchFinished(match)
                                              ? 'text-green-700 dark:text-green-400'
                                              : 'text-orange-700 dark:text-orange-400'
                                          }`}>
                                            {isMatchFinished(match) ? 'Final' : 'Live'}
                                          </span>
                                          <span className={`text-xs font-bold ${
                                            isMatchFinished(match)
                                              ? 'text-green-700 dark:text-green-400'
                                              : 'text-orange-700 dark:text-orange-400'
                                          }`}>
                                            {match.home_score} - {match.away_score}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="h-5"></div>
                                      )}

                                      {/* Pronostic de l'utilisateur */}
                                      <div className="flex items-center gap-1">
                                        <span className="text-base font-bold theme-text">
                                          {prediction.predicted_home_score ?? 0}
                                        </span>
                                        <span className="theme-text-secondary font-bold text-sm">−</span>
                                        <span className="text-base font-bold theme-text">
                                          {prediction.predicted_away_score ?? 0}
                                        </span>
                                      </div>

                                      {/* Points gagnés */}
                                      {hasFirstMatchStarted() && matchPoints[match.id] !== undefined ? (
                                        <div
                                          className="px-2 py-0.5 rounded font-bold text-xs whitespace-nowrap"
                                          style={getPointsColorStyle(matchPoints[match.id])}
                                        >
                                          {matchPoints[match.id] > 0 ? `+${matchPoints[match.id]}` : '0'} pts
                                        </div>
                                      ) : (
                                        <div className="h-4"></div>
                                      )}
                                    </div>

                                    {/* COLONNE 3 - Équipe extérieure */}
                                    <div className="flex flex-col items-center gap-1">
                                      {/* Badge prono par défaut en haut si applicable - aligné à droite */}
                                      <div className="w-full flex justify-end mb-1">
                                        {prediction.is_default_prediction ? (
                                          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-[9px] opacity-70">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-yellow-600 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span className="font-medium text-yellow-700 dark:text-yellow-500">Défaut</span>
                                          </div>
                                        ) : (
                                          <div className="h-5"></div>
                                        )}
                                      </div>
                                      {/* Logo équipe */}
                                      {match.away_team_crest && (
                                        <img
                                          src={match.away_team_crest}
                                          alt={translateTeamName(match.away_team_name)}
                                          className="w-10 h-10 object-contain flex-shrink-0"
                                        />
                                      )}
                                      {/* Nom équipe */}
                                      <span className="theme-text font-medium text-center text-xs leading-tight">
                                        {translateTeamName(match.away_team_name)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Ligne de modification du pronostic (uniquement si pas clôturé) */}
                                  {/* Sur mobile : masquée si prono sauvegardé et verrouillé */}
                                  {!isClosed && (
                                    <div className={`items-center justify-center gap-2 mb-3 ${
                                      isSaved && !isModified && isLocked
                                        ? 'hidden md:flex'
                                        : 'flex'
                                    }`}>
                                      {/* Boutons pour score domicile - cachés si prono enregistré et non modifié */}
                                      <div
                                        className="flex flex-col gap-0.5"
                                        style={{ visibility: savedPredictions[match.id] && !isModified ? 'hidden' : 'visible' }}
                                      >
                                        <button
                                          onClick={() => {
                                            const newValue = Math.min(9, (prediction.predicted_home_score ?? 0) + 1)
                                            handleScoreChange(match.id, 'home', newValue)
                                          }}
                                          disabled={isLocked}
                                          className="btn-score-adjust"
                                        >
                                          +
                                        </button>
                                        <button
                                          onClick={() => {
                                            const newValue = Math.max(0, (prediction.predicted_home_score ?? 0) - 1)
                                            handleScoreChange(match.id, 'home', newValue)
                                          }}
                                          disabled={isLocked}
                                          className="btn-score-adjust"
                                        >
                                          −
                                        </button>
                                      </div>

                                      {/* Input domicile */}
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
                                        disabled={isLocked}
                                        className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                      />

                                      <span className="theme-text-secondary font-bold text-lg">−</span>

                                      {/* Input extérieur */}
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
                                        disabled={isLocked}
                                        className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                      />

                                      {/* Boutons pour score extérieur - cachés si prono enregistré et non modifié */}
                                      <div
                                        className="flex flex-col gap-0.5"
                                        style={{ visibility: savedPredictions[match.id] && !isModified ? 'hidden' : 'visible' }}
                                      >
                                        <button
                                          onClick={() => {
                                            const newValue = Math.min(9, (prediction.predicted_away_score ?? 0) + 1)
                                            handleScoreChange(match.id, 'away', newValue)
                                          }}
                                          disabled={isLocked}
                                          className="btn-score-adjust"
                                        >
                                          +
                                        </button>
                                        <button
                                          onClick={() => {
                                            const newValue = Math.max(0, (prediction.predicted_away_score ?? 0) - 1)
                                            handleScoreChange(match.id, 'away', newValue)
                                          }}
                                          disabled={isLocked}
                                          className="btn-score-adjust"
                                        >
                                          −
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Bouton d'action (sauvegarder/modifier) */}
                                  <div className="flex justify-center">
                                    {isClosed ? (
                                      hasFirstMatchStarted() ? null : (
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 opacity-50 cursor-not-allowed">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                          </svg>
                                          <span className="text-xs font-medium">Clôturé</span>
                                        </div>
                                      )
                                    ) : isSaved && !isModified && isLocked ? (
                                      <div className="flex items-center gap-2">
                                        <div className="badge-prono-validated">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                          </svg>
                                        </div>
                                        <button
                                          onClick={() => unlockPrediction(match.id)}
                                          className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-gray-700 rounded-lg text-blue-600 dark:text-gray-300 hover:bg-blue-200 hover:text-blue-700 dark:hover:bg-gray-600 dark:hover:text-gray-200 transition"
                                          title="Modifier le pronostic"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                          </svg>
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => savePrediction(match.id)}
                                        disabled={savingPrediction === match.id}
                                        className="px-3 py-1.5 rounded-lg transition font-semibold flex items-center gap-2 text-xs bg-[#ff9900] text-[#111] hover:bg-[#e68a00] disabled:bg-gray-400 disabled:cursor-not-allowed"
                                      >
                                        {savingPrediction === match.id ? (
                                          <>
                                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Envoi...</span>
                                          </>
                                        ) : (
                                          <span>Enregistrer</span>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Affichage DESKTOP */}
                                <div className="hidden md:block relative">
                                  <div className="flex items-center gap-3 w-full">
                                    {/* COLONNE GAUCHE 15% - Horaire, logo compétition et badge bonus (alignés à gauche) */}
                                    <div className="flex flex-col items-start gap-1 w-[15%] flex-shrink-0 overflow-hidden">
                                      <div className="text-sm theme-text-secondary font-semibold whitespace-nowrap">
                                        {matchTime}
                                      </div>
                                      {/* Logo de la compétition source (uniquement pour tournois custom) */}
                                      {tournament?.custom_competition_id && match.competition_emblem && (
                                        <div className="flex items-center justify-start" title={match.competition_name || ''}>
                                          {/* Logo couleur pour thème clair */}
                                          <img
                                            src={match.competition_emblem}
                                            alt={match.competition_name || 'Compétition'}
                                            className="w-8 h-8 object-contain show-on-light"
                                          />
                                          {/* Logo blanc pour thème sombre */}
                                          <img
                                            src={match.competition_emblem_white || match.competition_emblem}
                                            alt={match.competition_name || 'Compétition'}
                                            className="w-8 h-8 object-contain show-on-dark"
                                          />
                                        </div>
                                      )}
                                      {isBonusMatch && (
                                        <div className="bonus-badge flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded text-[10px] font-bold text-white shadow-lg whitespace-nowrap">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                          </svg>
                                          <span>BONUS</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* COLONNE CENTRALE 70% - Match et scores (organisation avec axe central) */}
                                    <div className="flex flex-col gap-2 flex-1 overflow-hidden">
                                      {/* Badges en haut (verrouillé, score final ou reporté) */}
                                      <div className="flex items-center justify-center min-h-[28px]">
                                        {/* Badge REPORTÉ si le match est postponed */}
                                        {match.status === 'POSTPONED' && (
                                          <div className="flex items-center gap-2 px-3 py-1 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-600 dark:text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">
                                              Match reporté
                                            </span>
                                          </div>
                                        )}
                                        {/* Badge VERROUILLÉ */}
                                        {match.status !== 'POSTPONED' && isClosed && !isMatchInProgress && !isMatchFinished(match) && (
                                          <div className="flex items-center gap-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-700">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 dark:text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                              Verrouillé
                                            </span>
                                          </div>
                                        )}
                                        {/* Badge SCORE FINAL ou EN DIRECT */}
                                        {match.status !== 'POSTPONED' && match.home_score !== null && match.away_score !== null && isMatchInProgress && (
                                          <div className={`flex items-center gap-2 px-3 py-1 rounded ${
                                            isMatchFinished(match)
                                              ? 'bg-green-100 dark:bg-green-900/30'
                                              : 'bg-orange-100 dark:bg-orange-900/30 animate-pulse'
                                          }`}>
                                            <span className={`text-xs font-semibold ${
                                              isMatchFinished(match)
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-orange-700 dark:text-orange-400'
                                            }`}>
                                              {isMatchFinished(match) ? 'Score final :' : 'En direct :'}
                                            </span>
                                            <span className={`text-sm font-bold ${
                                              isMatchFinished(match)
                                                ? 'text-green-700 dark:text-green-400'
                                                : 'text-orange-700 dark:text-orange-400'
                                            }`}>
                                              {match.home_score} - {match.away_score}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Affichage du match avec axe de centrage sur les scores */}
                                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                                        {/* Partie gauche: Équipe domicile + Logo */}
                                        <div className="flex items-center gap-2 justify-end">
                                          <span className="theme-text font-medium text-right truncate">
                                            {translateTeamName(match.home_team_name)}
                                          </span>
                                          {match.home_team_crest && (
                                            <img
                                              src={match.home_team_crest}
                                              alt={translateTeamName(match.home_team_name)}
                                              className="w-8 h-8 object-contain flex-shrink-0"
                                            />
                                          )}
                                        </div>

                                        {/* Axe central: Scores pronostiqués (centré et fixe) */}
                                        <div className="flex items-center gap-2">
                                          {/* Score domicile */}
                                          <div className="flex items-center gap-1">
                                            {!isClosed && match.status !== 'POSTPONED' && (
                                              <div
                                                className="flex flex-col gap-0.5"
                                                style={{ visibility: savedPredictions[match.id] && !isModified ? 'hidden' : 'visible' }}
                                              >
                                                <button
                                                  onClick={() => {
                                                    const newValue = Math.min(9, (prediction.predicted_home_score ?? 0) + 1)
                                                    handleScoreChange(match.id, 'home', newValue)
                                                  }}
                                                  disabled={isLocked}
                                                  className="btn-score-adjust w-6 h-5 text-sm"
                                                >
                                                  +
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    const newValue = Math.max(0, (prediction.predicted_home_score ?? 0) - 1)
                                                    handleScoreChange(match.id, 'home', newValue)
                                                  }}
                                                  disabled={isLocked}
                                                  className="btn-score-adjust w-6 h-5 text-sm"
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
                                              disabled={isClosed || isLocked || match.status === 'POSTPONED'}
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
                                              disabled={isClosed || isLocked || match.status === 'POSTPONED'}
                                              className="w-12 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded focus:border-[#ff9900] focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            />
                                            {!isClosed && match.status !== 'POSTPONED' && (
                                              <div
                                                className="flex flex-col gap-0.5"
                                                style={{ visibility: savedPredictions[match.id] && !isModified ? 'hidden' : 'visible' }}
                                              >
                                                <button
                                                  onClick={() => {
                                                    const newValue = Math.min(9, (prediction.predicted_away_score ?? 0) + 1)
                                                    handleScoreChange(match.id, 'away', newValue)
                                                  }}
                                                  disabled={isLocked}
                                                  className="btn-score-adjust w-6 h-5 text-sm"
                                                >
                                                  +
                                                </button>
                                                <button
                                                  onClick={() => {
                                                    const newValue = Math.max(0, (prediction.predicted_away_score ?? 0) - 1)
                                                    handleScoreChange(match.id, 'away', newValue)
                                                  }}
                                                  disabled={isLocked}
                                                  className="btn-score-adjust w-6 h-5 text-sm"
                                                >
                                                  −
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Partie droite: Logo + Équipe extérieure */}
                                        <div className="flex items-center gap-2 justify-start">
                                          {match.away_team_crest && (
                                            <img
                                              src={match.away_team_crest}
                                              alt={translateTeamName(match.away_team_name)}
                                              className="w-8 h-8 object-contain flex-shrink-0"
                                            />
                                          )}
                                          <span className="theme-text font-medium text-left truncate">
                                            {translateTeamName(match.away_team_name)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* COLONNE DROITE 15% - Points et badge défaut (alignés à droite) */}
                                    <div className="flex flex-col items-end gap-1 w-[15%] flex-shrink-0 overflow-hidden">
                                      {/* Badge défaut - affiché au-dessus des points */}
                                      {(prediction.is_default_prediction || defaultPredictions[match.id]) && isClosed && (hasFirstMatchStarted() || matchPoints[match.id] !== undefined) && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-[9px]">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-yellow-600 dark:text-yellow-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                          </svg>
                                          <span className="font-medium text-yellow-700 dark:text-yellow-500">Défaut</span>
                                        </div>
                                      )}

                                      {/* Points gagnés */}
                                      {isClosed && (hasFirstMatchStarted() || matchPoints[match.id] !== undefined) && matchPoints[match.id] !== undefined && (
                                        <div
                                          className="px-2 py-1 rounded-lg font-bold text-xs"
                                          style={getPointsColorStyle(matchPoints[match.id])}
                                        >
                                          {matchPoints[match.id] > 0 ? `+${matchPoints[match.id]}` : '0'} pts
                                        </div>
                                      )}

                                      {/* Boutons d'action */}
                                      {isClosed ? (
                                        !(hasFirstMatchStarted() || matchPoints[match.id] !== undefined) && (
                                          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 opacity-50 cursor-not-allowed">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-[10px] font-medium">Clôturé</span>
                                          </div>
                                        )
                                      ) : isSaved && !isModified && isLocked ? (
                                        <div className="flex items-center gap-1.5">
                                          <div className="badge-prono-validated flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                          </div>
                                          <button
                                            onClick={() => unlockPrediction(match.id)}
                                            className="flex items-center justify-center w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition flex-shrink-0"
                                            title="Modifier le pronostic"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                            </svg>
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => savePrediction(match.id)}
                                          disabled={savingPrediction === match.id}
                                          className={`px-2 py-1 rounded-lg transition font-semibold flex items-center gap-1.5 text-xs bg-[#ff9900] text-[#111] hover:bg-[#e68a00] disabled:bg-gray-400 disabled:cursor-not-allowed ${
                                            isModified ? 'animate-pulse-save' : ''
                                          }`}
                                        >
                                          {savingPrediction === match.id ? (
                                            <>
                                              <svg className="animate-spin h-3.5 w-3.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                              </svg>
                                              <span className="hidden xl:inline">Envoi...</span>
                                            </>
                                          ) : (
                                            <span className="hidden xl:inline">Enregistrer</span>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Accordéon pour voir les pronostics des autres (seulement si journée clôturée) */}
                                {isClosed && (
                                  <div className="mt-2 border-t theme-border pt-2">
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
                                              className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 theme-bg"
                                            >
                                              {/* Version MOBILE */}
                                              <div className="block md:hidden">
                                                <div className="grid grid-cols-3 gap-2 items-center">
                                                  {/* Colonne 1 - Avatar + Nom */}
                                                  <div className="flex flex-col items-center gap-1">
                                                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900]">
                                                      <Image
                                                        src={getAvatarUrl(playerPred.avatar || 'avatar1')}
                                                        alt={playerPred.username}
                                                        fill
                                                        className="object-cover"
                                                        sizes="32px"
                                                      />
                                                    </div>
                                                    <span className="theme-text font-medium text-xs text-center leading-tight">{playerPred.username}</span>
                                                  </div>

                                                  {/* Colonne 2 - Pronostic */}
                                                  <div className="flex flex-col items-center gap-1">
                                                    {playerPred.hasPronostic ? (
                                                      <>
                                                        <div className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-slate-700 rounded">
                                                          <span className="font-bold text-slate-900 dark:text-white text-base">{playerPred.predictedHome ?? 0}</span>
                                                          <span className="text-slate-500 dark:text-slate-400 text-sm">-</span>
                                                          <span className="font-bold text-slate-900 dark:text-white text-base">{playerPred.predictedAway ?? 0}</span>
                                                        </div>
                                                        {playerPred.isDefaultPrediction && (
                                                          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-[8px]">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-yellow-600 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-medium text-yellow-700 dark:text-yellow-500">Défaut</span>
                                                          </div>
                                                        )}
                                                      </>
                                                    ) : (
                                                      <span className="text-xs theme-text-secondary italic">Pas de prono</span>
                                                    )}
                                                  </div>

                                                  {/* Colonne 3 - Points */}
                                                  <div className="flex items-center justify-center">
                                                    {match.home_score !== null && match.away_score !== null && playerPred.hasPronostic && (
                                                      <div
                                                        className="px-2 py-1 rounded font-bold text-xs text-center"
                                                        style={getPointsColorStyle(playerPred.points)}
                                                      >
                                                        {playerPred.points > 0 ? `+${playerPred.points}` : '0'} pts
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Version DESKTOP */}
                                              <div className="hidden md:block">
                                                <div className="player-match-grid">
                                                  {/* COLONNE GAUCHE - Avatar et nom du joueur */}
                                                  <div className="flex items-center gap-2">
                                                    <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-[#ff9900] flex-shrink-0">
                                                      <Image
                                                        src={getAvatarUrl(playerPred.avatar || 'avatar1')}
                                                        alt={playerPred.username}
                                                        fill
                                                        className="object-cover"
                                                        sizes="32px"
                                                      />
                                                    </div>
                                                    <span className="theme-text font-medium truncate">{playerPred.username}</span>
                                                  </div>

                                                  {/* COLONNE CENTRALE - Pronostic centré */}
                                                  <div className="flex flex-col items-center gap-1">
                                                    {playerPred.hasPronostic ? (
                                                      <>
                                                        <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-slate-700 rounded">
                                                          <span className="font-bold text-slate-900 dark:text-white text-sm">{playerPred.predictedHome ?? 0}</span>
                                                          <span className="text-slate-500 dark:text-slate-400 text-sm">-</span>
                                                          <span className="font-bold text-slate-900 dark:text-white text-sm">{playerPred.predictedAway ?? 0}</span>
                                                        </div>
                                                        {playerPred.isDefaultPrediction && (
                                                          <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded text-[9px]">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-yellow-600 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                            <span className="font-medium text-yellow-700 dark:text-yellow-500">Défaut</span>
                                                          </div>
                                                        )}
                                                      </>
                                                    ) : (
                                                      <span className="text-xs theme-text-secondary italic">Pas de prono</span>
                                                    )}
                                                  </div>

                                                  {/* COLONNE DROITE - Points */}
                                                  <div className="flex items-center justify-end">
                                                    {match.home_score !== null && match.away_score !== null && playerPred.hasPronostic && (
                                                      <div
                                                        className="px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-xs md:text-sm whitespace-nowrap"
                                                        style={getPointsColorStyle(playerPred.points)}
                                                      >
                                                        {playerPred.points > 0 ? `+${playerPred.points}` : '0'} pts
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
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
              teamsEnabled={tournament.teams_enabled}
              tournamentType={tournament.tournament_type}
            />
          )}

          {activeTab === 'equipes' && tournament?.teams_enabled && (
            <div className="theme-card">
              <h2 className="text-2xl font-bold theme-accent-text mb-6">Composition des équipes</h2>

              {loadingTeams ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff9900]"></div>
                  <p className="mt-4 theme-text-secondary">Chargement des équipes...</p>
                </div>
              ) : teams.length === 0 ? (
                <div className="text-center py-12">
                  <img
                    src="/images/icons/team.svg"
                    alt="Équipes"
                    className="w-16 h-16 mx-auto mb-4 icon-filter-slate opacity-50"
                  />
                  <p className="theme-text-secondary">Aucune équipe n'a été constituée pour ce tournoi.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="theme-bg rounded-xl p-4 md:p-5 border theme-border"
                    >
                      {/* En-tête de l'équipe */}
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b theme-border">
                        <img
                          src={`/images/team-avatars/${team.avatar || 'team1'}.svg`}
                          alt={team.name}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-lg"
                        />
                        <div>
                          <h3 className="font-bold theme-text text-lg">{team.name}</h3>
                          <p className="text-xs theme-text-secondary">
                            {team.members.length} {team.members.length > 1 ? 'membres' : 'membre'}
                          </p>
                        </div>
                      </div>

                      {/* Liste des membres */}
                      <div className="space-y-2">
                        {team.members.map((member) => {
                          const isCurrentUser = member.userId === userId
                          return (
                            <div
                              key={member.id}
                              className={`flex items-center gap-3 p-2 rounded-lg ${
                                isCurrentUser ? 'bg-slate-700/30' : ''
                              }`}
                            >
                              <img
                                src={getAvatarUrl(member.avatar)}
                                alt={member.username}
                                className="w-8 h-8 rounded-full"
                              />
                              <span className={`font-medium ${
                                isCurrentUser
                                  ? 'theme-accent-text-always'
                                  : 'theme-text'
                              }`}>
                                {member.username}
                                {isCurrentUser && (
                                  <span className="ml-2 text-xs theme-text-secondary">(vous)</span>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'regles' && (
            <div className="theme-card">
              <h2 className="text-2xl font-bold theme-accent-text mb-2">Règles du tournoi</h2>
              {captainUsername && (
                <p className="theme-text-secondary mb-4">
                  Capitaine du tournoi : <span className="font-semibold theme-text">{captainUsername}</span>
                </p>
              )}
              <div className="space-y-4 theme-text-secondary">
                <div>
                  <h3 className="font-semibold theme-text mb-2">Système de points</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Score exact : {pointsSettings.exactScore} {pointsSettings.exactScore > 1 ? 'points' : 'point'}</li>
                    <li>Bon résultat (victoire/nul/défaite) : {pointsSettings.correctResult} {pointsSettings.correctResult > 1 ? 'points' : 'point'}</li>
                    <li>Mauvais pronostic : {pointsSettings.incorrectResult} point</li>
                  </ul>
                </div>

                {tournament?.bonus_match && (
                  <div className="quota-warning-box rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 quota-warning-icon flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <div>
                        <h3 className="font-semibold theme-text mb-2">Match Bonus activé</h3>
                        <p className="text-sm">
                          Un <span className="font-semibold theme-text">match bonus</span> est désigné à chaque journée.
                          Les points gagnés sur ce match sont <span className="font-semibold theme-text">doublés</span> !
                          Le match bonus est identifié par un badge {' '}
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded text-[9px] font-bold text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            BONUS
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {tournament?.early_prediction_bonus && (
                  <div className="quota-warning-box rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 quota-warning-icon flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="font-semibold theme-text mb-2">Prime d'avant-match activée</h3>
                        <p className="text-sm">
                          Si tous vos pronostics sont renseignés <span className="font-semibold theme-text">avant le début du premier match</span> de la journée,
                          vous gagnez <span className="font-semibold theme-text">1 point supplémentaire</span>.
                          Cette règle aide à lutter contre les forfaits et les oublis.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {tournament?.teams_enabled && (
                  <div className="quota-warning-box rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <img
                        src="/images/icons/team.svg"
                        alt="Équipes"
                        className="w-5 h-5 flex-shrink-0 mt-0.5 icon-filter-orange"
                      />
                      <div>
                        <h3 className="font-semibold theme-text mb-2">Classement par équipes activé</h3>
                        <p className="text-sm">
                          En plus du classement individuel, un <span className="font-semibold theme-text">classement par équipes</span> est disponible.
                          Le score d'une équipe correspond à la <span className="font-semibold theme-text">moyenne des points</span> de ses membres.
                          Consultez l'onglet "Équipes" pour voir la composition des équipes.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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
                    {!tournament?.all_matchdays && availableMatchdays.length > 0 && tournament?.num_matchdays && availableMatchdays.length < tournament.num_matchdays && (
                      <>
                        . Il se déroule finalement sur{' '}
                        <span className="font-semibold theme-text">{availableMatchdays.length}</span>{' '}
                        {availableMatchdays.length > 1 ? 'journées' : 'journée'}
                      </>
                    )}
                    .
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold theme-text mb-2">Délais de pronostic</h3>
                  <p>
                    Les pronostics doivent être saisis au minimum 30 minutes avant le coup d'envoi du match.{' '}
                    <span className="font-semibold theme-text">
                      Si ce délai venait à ne pas être respecté, c'est le score de 0-0 qui sera retenu et ne pourra pas donner plus de{' '}
                      {tournament?.scoring_default_prediction_max || 1}{' '}
                      {(tournament?.scoring_default_prediction_max || 1) > 1 ? 'points' : 'point'}{' '}
                      en cas de bon résultat ou de score exact.
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

          {activeTab === 'tchat' && tournament && userId && (
            <TournamentChat
              tournamentId={tournament.id}
              currentUserId={userId}
              currentUsername={username}
              currentUserAvatar={userAvatar}
            />
          )}
        </main>

        {/* Footer */}
        <Footer />

        {/* Modal d'extension du tournoi */}
        {showExtendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="theme-card w-full max-w-md rounded-xl shadow-xl p-6">
              <h3 className="text-xl font-bold theme-text mb-4 text-center">
                Étendre le tournoi
              </h3>

              <p className="theme-text-secondary text-center mb-6">
                De nouvelles journées sont disponibles dans cette compétition.
                Combien de journées souhaitez-vous ajouter ?
              </p>

              {/* Sélecteur +/- */}
              <div className="flex items-center justify-center gap-4 mb-6">
                <button
                  onClick={() => setMatchdaysToAdd(prev => Math.max(1, prev - 1))}
                  disabled={matchdaysToAdd <= 1}
                  className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:opacity-50 text-white text-2xl font-bold flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="w-20 h-16 flex items-center justify-center">
                  <span className="text-4xl font-bold text-[#ff9900]">{matchdaysToAdd}</span>
                </div>
                <button
                  onClick={() => setMatchdaysToAdd(prev => Math.min(availableToAdd, prev + 1))}
                  disabled={matchdaysToAdd >= availableToAdd}
                  className="w-12 h-12 rounded-full bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:opacity-50 text-white text-2xl font-bold flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>

              <p className="text-sm theme-text-secondary text-center mb-6">
                {availableToAdd} journée{availableToAdd > 1 ? 's' : ''} disponible{availableToAdd > 1 ? 's' : ''}
              </p>

              {/* Boutons d'action */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowExtendModal(false)
                    setMatchdaysToAdd(1)
                  }}
                  disabled={extendLoading}
                  className="flex-1 px-4 py-3 rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={extendTournament}
                  disabled={extendLoading}
                  className="flex-1 px-4 py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {extendLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      En cours...
                    </>
                  ) : (
                    <>
                      Confirmer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  )
}
