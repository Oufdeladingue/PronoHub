import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DebugModalType } from '@/lib/debug-modals'

interface TournamentData {
  id: string
  matchdays_count: number
  max_matchdays: number
  max_players: number
  current_participants: number
  duration_extended: boolean
  competition_id: number
}

interface UseIncentiveModalsProps {
  tournament: TournamentData
  currentJourneyNumber?: number
}

export function useIncentiveModals({ tournament, currentJourneyNumber }: UseIncentiveModalsProps) {
  const [shouldShowModal, setShouldShowModal] = useState<DebugModalType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkModalConditions()
  }, [tournament.id, currentJourneyNumber, tournament.current_participants])

  const checkModalConditions = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // 1. EXTENSION DE DURÉE - Opposition uniquement, quand il reste 2 journées
      const remainingJourneys = tournament.max_matchdays - (tournament.matchdays_count || 0)
      if (remainingJourneys === 2 && !tournament.duration_extended) {
        // Vérifier si l'user a déjà vu cette modale
        const { data: hasViewed } = await supabase
          .rpc('has_viewed_modal', {
            p_tournament_id: tournament.id,
            p_modal_type: 'duration_extension'
          })

        if (!hasViewed) {
          setShouldShowModal('duration_extension')
          setLoading(false)
          return
        }
      }

      // 2. EXTENSION DE CAPACITÉ - Échauffement, quand il reste 1 ou 2 places
      const remainingPlaces = tournament.max_players - tournament.current_participants
      if (remainingPlaces >= 1 && remainingPlaces <= 2) {
        // Vérifier si l'user a déjà vu cette modale
        const modalType = remainingPlaces === 2 ? 'player_extension_2_1' : 'player_extension_0'
        const { data: hasViewed } = await supabase
          .rpc('has_viewed_modal', {
            p_tournament_id: tournament.id,
            p_modal_type: modalType
          })

        if (!hasViewed) {
          setShouldShowModal(modalType as DebugModalType)
          setLoading(false)
          return
        }
      }

      // 3. OPTION STATS - Opposition, J1 puis toutes les 5 journées
      if (currentJourneyNumber) {
        const shouldShowStats = currentJourneyNumber === 1 || currentJourneyNumber % 5 === 0

        if (shouldShowStats) {
          // Vérifier si l'user a déjà acheté les stats
          const hasStatsAccess = await checkUserHasStatsAccess(user.id, tournament.id)

          if (!hasStatsAccess) {
            // Vérifier si l'user a déjà vu cette modale pour cette journée
            const { data: hasViewed } = await supabase
              .rpc('has_viewed_modal', {
                p_tournament_id: tournament.id,
                p_modal_type: 'stats_option'
              })

            if (!hasViewed) {
              setShouldShowModal('stats_option')
              setLoading(false)
              return
            }
          }
        }
      }

      setShouldShowModal(null)
      setLoading(false)
    } catch (error) {
      console.error('Erreur vérification conditions modales:', error)
      setLoading(false)
    }
  }

  const markModalAsViewed = async (modalType: DebugModalType) => {
    try {
      const supabase = createClient()
      await supabase.rpc('mark_modal_as_viewed', {
        p_tournament_id: tournament.id,
        p_modal_type: modalType
      })
    } catch (error) {
      console.error('Erreur marquage modale vue:', error)
    }
  }

  return {
    shouldShowModal,
    loading,
    markModalAsViewed
  }
}

// Helper pour vérifier l'accès stats
async function checkUserHasStatsAccess(userId: string, tournamentId: string): Promise<boolean> {
  const supabase = createClient()

  // Vérifier accès à vie
  const { data: lifetime } = await supabase
    .from('tournament_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('purchase_type', 'stats_access_lifetime')
    .eq('status', 'completed')
    .limit(1)
    .single()

  if (lifetime) return true

  // Vérifier accès pour ce tournoi
  const { data: tournament } = await supabase
    .from('tournament_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('tournament_id', tournamentId)
    .eq('purchase_type', 'stats_access_tournament')
    .eq('status', 'completed')
    .limit(1)
    .single()

  return !!tournament
}
