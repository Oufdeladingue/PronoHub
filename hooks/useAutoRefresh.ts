import { useState, useEffect, useRef, useCallback } from 'react'
import {
  calculateSmartRefreshInterval,
  shouldRefresh,
  formatTimeUntilRefresh,
  parseSettings,
  DEFAULT_SETTINGS,
  type Match
} from '@/lib/auto-refresh-utils'

interface UseAutoRefreshOptions {
  matches: Match[]
  onRefresh: () => Promise<void>
  enabled?: boolean
}

interface AutoRefreshState {
  isRefreshing: boolean
  lastRefreshTime: Date | null
  nextRefreshIn: number
  timeUntilRefresh: string
  settings: {
    enabled: boolean
    interval: number
    smartMode: boolean
    pauseInactive: boolean
  }
}

export function useAutoRefresh({ matches, onRefresh, enabled = true }: UseAutoRefreshOptions) {
  const [state, setState] = useState<AutoRefreshState>({
    isRefreshing: false,
    lastRefreshTime: null,
    nextRefreshIn: 0,
    timeUntilRefresh: '',
    settings: DEFAULT_SETTINGS
  })

  const [isPageVisible, setIsPageVisible] = useState(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const nextRefreshTimeRef = useRef<number>(0)
  const isRefreshingRef = useRef<boolean>(false)
  const onRefreshRef = useRef(onRefresh)
  const wasActiveRef = useRef<boolean>(false)

  // Garder la référence à jour
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  // Charger les paramètres depuis l'API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings')
        if (response.ok) {
          const data = await response.json()
          const parsedSettings = parseSettings(data.settings)
          setState(prev => ({
            ...prev,
            settings: parsedSettings
          }))
        }
      } catch (error) {
        console.error('Error fetching auto-refresh settings:', error)
      }
    }

    fetchSettings()
  }, [])

  // Surveiller la visibilité de la page
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(!document.hidden)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Mettre à jour le compte à rebours (fonction stable sans dépendances)
  const updateCountdown = useCallback(() => {
    const now = Date.now()
    const remaining = nextRefreshTimeRef.current - now

    if (remaining <= 0) {
      setState(prev => ({
        ...prev,
        nextRefreshIn: 0,
        timeUntilRefresh: 'Maintenant'
      }))
    } else {
      setState(prev => ({
        ...prev,
        nextRefreshIn: remaining,
        timeUntilRefresh: formatTimeUntilRefresh(remaining)
      }))
    }
  }, []) // Pas de dépendances - utilise uniquement des refs

  // Fonction de rafraîchissement (fonction stable utilisant des refs)
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return

    isRefreshingRef.current = true
    setState(prev => ({ ...prev, isRefreshing: true }))

    try {
      await onRefreshRef.current()
      setState(prev => ({
        ...prev,
        lastRefreshTime: new Date()
      }))
    } catch (error) {
      console.error('Error during auto-refresh:', error)
    } finally {
      isRefreshingRef.current = false
      setState(prev => ({ ...prev, isRefreshing: false }))
    }
  }, []) // Pas de dépendances - utilise uniquement des refs

  // Rafraîchissement manuel
  const manualRefresh = useCallback(async () => {
    // Arrêter le timer actuel
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    await refresh()

    // Redémarrer le timer après le rafraîchissement manuel
    // Le useEffect principal se chargera de le redémarrer si nécessaire
  }, [refresh])

  // Logique principale de rafraîchissement automatique
  useEffect(() => {
    // Nettoyer les timers existants
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }

    // Vérifier si le rafraîchissement doit être actif
    const shouldBeActive =
      enabled &&
      state.settings.enabled &&
      shouldRefresh(matches) &&
      (!state.settings.pauseInactive || isPageVisible)

    if (!shouldBeActive) {
      // Ne mettre à jour le state que si on était actif avant
      if (wasActiveRef.current) {
        setState(prev => ({
          ...prev,
          nextRefreshIn: 0,
          timeUntilRefresh: ''
        }))
        wasActiveRef.current = false
      }
      return
    }

    wasActiveRef.current = true

    // Calculer l'intervalle de rafraîchissement
    const interval = calculateSmartRefreshInterval(
      matches,
      state.settings.interval,
      state.settings.smartMode
    )

    // Programmer le prochain rafraîchissement
    nextRefreshTimeRef.current = Date.now() + interval
    timerRef.current = setTimeout(refresh, interval)

    // Démarrer le compte à rebours (mise à jour toutes les secondes)
    updateCountdown()
    countdownRef.current = setInterval(updateCountdown, 1000)

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [
    enabled,
    state.settings.enabled,
    state.settings.interval,
    state.settings.smartMode,
    state.settings.pauseInactive,
    isPageVisible,
    matches
    // refresh et updateCountdown sont stables (pas de dépendances)
  ])

  return {
    ...state,
    manualRefresh,
    isActive: enabled && state.settings.enabled && shouldRefresh(matches)
  }
}
