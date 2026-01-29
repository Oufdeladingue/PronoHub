'use client'

import { useState, useEffect } from 'react'
import { fetchWithAuth } from '@/lib/supabase/client'

type AccessReason = 'admin' | 'elite' | 'platinium' | 'lifetime' | 'tournament' | 'none'

interface StatsAccessResult {
  hasAccess: boolean
  reason: AccessReason
  loading: boolean
  error: string | null
}

// Cache global pour éviter les requêtes multiples
const accessCache = new Map<string, { hasAccess: boolean; reason: AccessReason; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function useStatsAccess(tournamentId: string): StatsAccessResult {
  const [hasAccess, setHasAccess] = useState(false)
  const [reason, setReason] = useState<AccessReason>('none')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      // Vérifier le cache
      const cached = accessCache.get(tournamentId)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setHasAccess(cached.hasAccess)
        setReason(cached.reason)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await fetchWithAuth(`/api/stats/access?tournamentId=${tournamentId}`)

        if (!response.ok) {
          throw new Error('Erreur lors de la vérification de l\'accès')
        }

        const data = await response.json()

        // Mettre en cache
        accessCache.set(tournamentId, {
          hasAccess: data.hasAccess,
          reason: data.reason,
          timestamp: Date.now()
        })

        setHasAccess(data.hasAccess)
        setReason(data.reason)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue')
        setHasAccess(false)
        setReason('none')
      } finally {
        setLoading(false)
      }
    }

    if (tournamentId) {
      checkAccess()
    }
  }, [tournamentId])

  return { hasAccess, reason, loading, error }
}

// Fonction pour invalider le cache après un achat
export function invalidateStatsAccessCache(tournamentId?: string) {
  if (tournamentId) {
    accessCache.delete(tournamentId)
  } else {
    // Invalider tout le cache (après achat lifetime par exemple)
    accessCache.clear()
  }
}
