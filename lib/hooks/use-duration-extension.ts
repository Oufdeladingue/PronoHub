import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useDurationExtension(tournamentId: string) {
  const [hasCredit, setHasCredit] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkCredit()
  }, [tournamentId])

  const checkCredit = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setHasCredit(false)
        setLoading(false)
        return
      }

      // Vérifier s'il existe un crédit d'extension de durée non utilisé pour ce tournoi
      const { data, error } = await supabase
        .from('tournament_purchases')
        .select('id')
        .eq('user_id', user.id)
        .eq('tournament_id', tournamentId)
        .eq('purchase_type', 'duration_extension')
        .eq('status', 'completed')
        .eq('used', false)
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erreur vérification crédit:', error)
      }

      setHasCredit(!!data)
    } catch (error) {
      console.error('Erreur:', error)
      setHasCredit(false)
    } finally {
      setLoading(false)
    }
  }

  const applyExtension = async (journeysToAdd: number) => {
    const response = await fetch('/api/extensions/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extensionType: 'duration_extension',
        tournamentId,
        options: { journeysToAdd }
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Erreur lors de l\'application de l\'extension')
    }

    // Recharger le crédit après application
    await checkCredit()

    return data
  }

  return {
    hasCredit,
    loading,
    applyExtension,
    refreshCredit: checkCredit
  }
}
