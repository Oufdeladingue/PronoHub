'use client'

import { useEffect, useState, useCallback } from 'react'
import { UserQuotas, TournamentType, Feature, ACCOUNT_LIMITS } from '@/types/monetization'

interface FeatureAccessState {
  loading: boolean
  quotas: UserQuotas | null
  tournamentType: TournamentType | null
  canCreateTournament: boolean
  hasFeature: (feature: Feature) => boolean
  getMaxPlayers: () => number
  refresh: () => Promise<void>
}

export function useFeatureAccess(): FeatureAccessState {
  const [loading, setLoading] = useState(true)
  const [quotas, setQuotas] = useState<UserQuotas | null>(null)
  const [tournamentType, setTournamentType] = useState<TournamentType | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch quotas
      const quotasResponse = await fetch('/api/user/quotas')
      const quotasData = await quotasResponse.json()
      if (quotasData.success) {
        setQuotas(quotasData.quotas)
      }

      // Fetch tournament type
      const typeResponse = await fetch('/api/user/quotas', { method: 'POST' })
      const typeData = await typeResponse.json()
      if (typeData.success && typeData.result) {
        setTournamentType(typeData.result.tournament_type)
      }
    } catch (error) {
      console.error('Error fetching feature access:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const hasFeature = useCallback((feature: Feature): boolean => {
    if (!tournamentType) {
      // Par defaut, verifier avec le type gratuit
      return ACCOUNT_LIMITS.free.features.includes(feature)
    }
    return ACCOUNT_LIMITS[tournamentType].features.includes(feature)
  }, [tournamentType])

  const getMaxPlayers = useCallback((): number => {
    if (!tournamentType) {
      return ACCOUNT_LIMITS.free.maxPlayersPerTournament
    }
    return ACCOUNT_LIMITS[tournamentType].maxPlayersPerTournament
  }, [tournamentType])

  return {
    loading,
    quotas,
    tournamentType,
    canCreateTournament: quotas?.can_create_tournament ?? false,
    hasFeature,
    getMaxPlayers,
    refresh: fetchData,
  }
}

// Hook pour verifier l'acces a une feature specifique d'un tournoi
export function useTournamentFeatures(tournamentType: TournamentType | null) {
  const hasFeature = useCallback((feature: Feature): boolean => {
    if (!tournamentType) return false
    return ACCOUNT_LIMITS[tournamentType].features.includes(feature)
  }, [tournamentType])

  const getMaxPlayers = useCallback((): number => {
    if (!tournamentType) return 8
    return ACCOUNT_LIMITS[tournamentType].maxPlayersPerTournament
  }, [tournamentType])

  return {
    hasFeature,
    getMaxPlayers,
    features: tournamentType ? ACCOUNT_LIMITS[tournamentType].features : [],
  }
}
