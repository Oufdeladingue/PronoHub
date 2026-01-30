import { useEffect, useState, useRef } from 'react'
import { fetchWithAuth } from '@/lib/supabase/client'

interface Trophy {
  id: number
  user_id: string
  trophy_type: string
  unlocked_at: string
  is_new: boolean
}

interface TrophyNotification extends Trophy {
  name: string
  description: string
  imagePath: string
  // Infos du match déclencheur (sera chargé séparément)
  triggerMatch?: {
    homeTeamName: string
    awayTeamName: string
    homeTeamCrest: string | null
    awayTeamCrest: string | null
    competitionId: number
    homeScore?: number
    awayScore?: number
  }
}

/**
 * Hook pour détecter et afficher les nouveaux trophées débloqués
 * Stratégie optimisée inspirée de la page profile :
 * 1. Vérifier si on a déjà calculé aujourd'hui (localStorage)
 * 2. Si non → charger trophées stockés (rapide)
 * 3. Lancer recalcul en arrière-plan (lent)
 * 4. Si nouveaux trophées → charger infos complètes + match déclencheur
 */
export function useTrophyNotifications() {
  const [newTrophies, setNewTrophies] = useState<TrophyNotification[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [currentTrophyIndex, setCurrentTrophyIndex] = useState(0)

  useEffect(() => {
    checkForNewTrophies()
  }, [])

  const checkForNewTrophies = async () => {
    // Vérifier si on a déjà calculé aujourd'hui
    const lastCheck = localStorage.getItem('trophy_last_check')
    const today = new Date().toDateString()

    console.log('[TrophyNotifications] lastCheck:', lastCheck, 'today:', today)

    if (lastCheck === today) {
      // Déjà vérifié aujourd'hui, pas besoin de recalculer
      console.log('[TrophyNotifications] Déjà vérifié aujourd\'hui, skip')
      return
    }

    setIsChecking(true)

    try {
      // 1. Charger d'abord les trophées stockés (rapide)
      console.log('[TrophyNotifications] Appel API /api/user/trophies...')
      const response = await fetchWithAuth('/api/user/trophies')
      const data = await response.json()

      console.log('[TrophyNotifications] Réponse API:', data)

      if (!data.success) {
        console.log('[TrophyNotifications] API non success, arrêt')
        setIsChecking(false)
        return
      }

      // Vérifier d'abord s'il y a des trophées is_new dans les trophées stockés
      const existingNewTrophies = data.trophies?.filter((t: Trophy) => t.is_new) || []
      console.log('[TrophyNotifications] Trophées is_new trouvés:', existingNewTrophies)

      if (existingNewTrophies.length > 0) {
        console.log('[TrophyNotifications] Chargement des détails pour', existingNewTrophies.length, 'trophées')
        // Charger les infos complètes pour les trophées existants marqués comme nouveaux
        const trophiesWithDetails = await Promise.all(
          existingNewTrophies.map(async (trophy: Trophy) => {
            const trophyInfo = getTrophyInfo(trophy.trophy_type)

            // Charger les infos du match déclencheur
            try {
              const matchResponse = await fetchWithAuth(
                `/api/user/trophy-unlock-info?trophyType=${encodeURIComponent(trophy.trophy_type)}&unlockedAt=${encodeURIComponent(trophy.unlocked_at)}`
              )
              const matchData = await matchResponse.json()

              return {
                ...trophy,
                ...trophyInfo,
                triggerMatch: matchData.success ? matchData.match : undefined
              }
            } catch (error) {
              console.error('Error loading trigger match:', error)
              return {
                ...trophy,
                ...trophyInfo
              }
            }
          })
        )

        console.log('[TrophyNotifications] Trophées avec détails:', trophiesWithDetails)
        setNewTrophies(trophiesWithDetails)
        localStorage.setItem('trophy_last_check', today)
        setIsChecking(false)
        console.log('[TrophyNotifications] ✅ Trophées définis, modale devrait s\'afficher')
        return
      }

      // 2. Lancer le recalcul en arrière-plan
      const refreshResponse = await fetchWithAuth('/api/user/trophies', { method: 'PUT' })
      const refreshData = await refreshResponse.json()

      if (refreshData.success && refreshData.newTrophiesUnlocked > 0) {
        // On a de nouveaux trophées !
        const newTrophiesData = refreshData.trophies.filter((t: Trophy) => t.is_new)

        // Charger les infos complètes pour chaque nouveau trophée
        const trophiesWithDetails = await Promise.all(
          newTrophiesData.map(async (trophy: Trophy) => {
            const trophyInfo = getTrophyInfo(trophy.trophy_type)

            // Charger les infos du match déclencheur
            try {
              const matchResponse = await fetchWithAuth(
                `/api/user/trophy-unlock-info?trophyType=${encodeURIComponent(trophy.trophy_type)}&unlockedAt=${encodeURIComponent(trophy.unlocked_at)}`
              )
              const matchData = await matchResponse.json()

              return {
                ...trophy,
                ...trophyInfo,
                triggerMatch: matchData.success ? matchData.match : undefined
              }
            } catch (error) {
              console.error('Error loading trigger match:', error)
              return {
                ...trophy,
                ...trophyInfo
              }
            }
          })
        )

        setNewTrophies(trophiesWithDetails)

        // Marquer comme vérifié aujourd'hui
        localStorage.setItem('trophy_last_check', today)
      } else {
        // Pas de nouveaux trophées, mais on marque quand même comme vérifié
        localStorage.setItem('trophy_last_check', today)
      }
    } catch (error) {
      console.error('Error checking for new trophies:', error)
    } finally {
      setIsChecking(false)
    }
  }

  // Fonction pour passer au trophée suivant
  const nextTrophy = () => {
    if (currentTrophyIndex < newTrophies.length - 1) {
      setCurrentTrophyIndex(prev => prev + 1)
    } else {
      // Tous les trophées ont été affichés, marquer comme vus
      markTrophiesAsViewed()
    }
  }

  // Marquer tous les trophées comme vus
  const markTrophiesAsViewed = async () => {
    try {
      await fetchWithAuth('/api/user/trophies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trophyIds: newTrophies.map(t => t.id)
        })
      })

      // Vider la liste des nouveaux trophées
      setNewTrophies([])
      setCurrentTrophyIndex(0)
    } catch (error) {
      console.error('Error marking trophies as viewed:', error)
    }
  }

  // Fermer la modale actuelle (marquer le trophée comme vu et passer au suivant)
  const closeCurrentTrophy = () => {
    nextTrophy()
  }

  // Référence stable pour la simulation (évite stale closure)
  const simulateTrophyRef = useRef<(type?: string) => void>()

  // Mettre à jour la référence à chaque rendu
  simulateTrophyRef.current = (trophyType?: string) => {
    const type = trophyType || 'exact_score'
    const info = getTrophyInfo(type)

    const fakeTrophy: TrophyNotification = {
      id: 9999,
      user_id: 'test-user',
      trophy_type: type,
      unlocked_at: new Date().toISOString(),
      is_new: true,
      name: info.name,
      description: info.description,
      imagePath: info.imagePath,
      triggerMatch: {
        homeTeamName: 'Paris Saint-Germain',
        awayTeamName: 'Olympique de Marseille',
        homeTeamCrest: 'https://crests.football-data.org/524.png',
        awayTeamCrest: 'https://crests.football-data.org/516.png',
        competitionId: 2015,
        homeScore: 3,
        awayScore: 1
      }
    }

    setNewTrophies([fakeTrophy])
    setCurrentTrophyIndex(0)
    console.log(`[TrophyNotifications] Simulation du trophée "${info.name}" (${type})`)
  }

  // Exposer la fonction de simulation sur window (dev uniquement)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const trophyTypes = [
        'correct_result', 'exact_score', 'king_of_day', 'double_king',
        'opportunist', 'nostradamus', 'lantern', 'downward_spiral',
        'bonus_profiteer', 'bonus_optimizer', 'ultra_dominator',
        'poulidor', 'cursed', 'tournament_winner', 'legend', 'abyssal'
      ]

      ;(window as any).testTrophyModal = (type?: string) => {
        if (type && !trophyTypes.includes(type)) {
          console.log('Types disponibles:', trophyTypes.join(', '))
          return
        }
        // Utiliser la ref pour éviter stale closure
        simulateTrophyRef.current?.(type)
      }

      console.log('[TrophyNotifications] window.testTrophyModal() disponible')
    }
  }, [])

  // Wrapper stable pour simulateTrophy
  const simulateTrophy = (type?: string) => simulateTrophyRef.current?.(type)

  return {
    newTrophies,
    currentTrophy: newTrophies[currentTrophyIndex],
    currentTrophyIndex,
    hasNewTrophies: newTrophies.length > 0,
    isChecking,
    closeCurrentTrophy,
    markAllAsViewed: markTrophiesAsViewed,
    simulateTrophy
  }
}

// Fonction helper pour obtenir les infos d'un trophée (copiée depuis profile/page.tsx)
function getTrophyInfo(trophyType: string): { name: string; description: string; imagePath: string } {
  const trophyMap: Record<string, { name: string; description: string; imagePath: string }> = {
    correct_result: {
      name: 'Le Veinard',
      description: 'Pronostiquer au moins 1 bon résultat',
      imagePath: '/trophy/bon-resultat.png'
    },
    exact_score: {
      name: 'L\'Analyste',
      description: 'Pronostiquer au moins 1 score exact',
      imagePath: '/trophy/score-exact.png'
    },
    king_of_day: {
      name: 'The King of Day',
      description: 'Être premier au classement d\'une journée (sans égalité)',
      imagePath: '/trophy/king-of-day.png'
    },
    double_king: {
      name: 'Le Roi du Doublé',
      description: 'Être premier à deux journées consécutives',
      imagePath: '/trophy/double.png'
    },
    opportunist: {
      name: 'L\'Opportuniste',
      description: '2 bons résultats sur la même journée',
      imagePath: '/trophy/opportuniste.png'
    },
    nostradamus: {
      name: 'Le Nostradamus',
      description: '2 scores exacts sur la même journée',
      imagePath: '/trophy/nostra.png'
    },
    lantern: {
      name: 'La Lanterne-rouge',
      description: 'Être dernier au classement d\'une journée (sans égalité)',
      imagePath: '/trophy/lanterne.png'
    },
    downward_spiral: {
      name: 'La Spirale infernale',
      description: 'Être dernier deux journées de suite',
      imagePath: '/trophy/spirale.png'
    },
    bonus_profiteer: {
      name: 'Le Profiteur',
      description: '1 bon résultat sur un match Bonus',
      imagePath: '/trophy/profiteur.png'
    },
    bonus_optimizer: {
      name: 'L\'Optimisateur',
      description: '1 score exact sur un match Bonus',
      imagePath: '/trophy/optimisateur.png'
    },
    ultra_dominator: {
      name: 'L\'Ultra-dominateur',
      description: 'Être premier à CHAQUE journée du tournoi',
      imagePath: '/trophy/dominateur.png'
    },
    poulidor: {
      name: 'Le Poulidor',
      description: 'Aucune première place sur toutes les journées d\'un tournoi terminé',
      imagePath: '/trophy/poulidor.png'
    },
    cursed: {
      name: 'Le Maudit',
      description: 'Aucun bon résultat sur une journée de tournoi',
      imagePath: '/trophy/maudit.png'
    },
    tournament_winner: {
      name: 'Le Ballon d\'or',
      description: '1er au classement final d\'un tournoi (sans égalité)',
      imagePath: '/trophy/tournoi.png'
    },
    legend: {
      name: 'La Légende',
      description: 'Vainqueur d\'un tournoi avec plus de 10 participants',
      imagePath: '/trophy/LEGENDE.png'
    },
    abyssal: {
      name: 'L\'Abyssal',
      description: 'Dernier au classement final d\'un tournoi (sans égalité)',
      imagePath: '/trophy/abyssal.png'
    }
  }

  return trophyMap[trophyType] || {
    name: 'Trophée Inconnu',
    description: 'Description non disponible',
    imagePath: '/trophy/default.png'
  }
}
