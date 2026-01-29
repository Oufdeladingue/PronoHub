import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint de debug pour tester trophy-unlock-info SANS middleware
 */
export async function GET(request: NextRequest) {
  const logs: string[] = []

  try {
    logs.push('[DEBUG] Début')
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    logs.push(`[DEBUG] User: ${user?.id || 'none'}`)

    if (!user) {
      return NextResponse.json({ logs, error: 'Non authentifié' }, { status: 401 })
    }

    const trophyType = 'cursed'
    const unlockedAt = '2026-01-29T21:34:39.094+00:00'
    const unlockDate = new Date(unlockedAt)

    logs.push(`[DEBUG] Trophy: ${trophyType}, Date: ${unlockDate}`)

    // Test direct de la requête fallback
    logs.push('[DEBUG] Test requête imported_matches...')
    const { data: importedMatches, error } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('status', 'FINISHED')
      .lte('utc_date', unlockDate.toISOString())
      .order('utc_date', { ascending: false })
      .limit(1)

    logs.push(`[DEBUG] Résultat: ${importedMatches?.length || 0} matchs trouvés`)

    if (error) {
      logs.push(`[DEBUG] ERREUR SQL: ${error.message}`)
      logs.push(`[DEBUG] Error details: ${JSON.stringify(error)}`)
      return NextResponse.json({ logs, error: error.message }, { status: 500 })
    }

    if (!importedMatches || importedMatches.length === 0) {
      logs.push('[DEBUG] Aucun match trouvé')
      return NextResponse.json({ logs, match: null })
    }

    const match = importedMatches[0]
    logs.push(`[DEBUG] Match trouvé: ${match.home_team_name} vs ${match.away_team_name}`)
    logs.push(`[DEBUG] Colonnes: ${Object.keys(match).join(', ')}`)

    const result = {
      homeTeamName: match.home_team_name,
      awayTeamName: match.away_team_name,
      homeTeamCrest: match.home_team_crest,
      awayTeamCrest: match.away_team_crest,
      competitionId: match.competition_id
    }

    logs.push(`[DEBUG] Résultat final: ${JSON.stringify(result)}`)

    return NextResponse.json({
      success: true,
      logs,
      match: result
    })
  } catch (error: any) {
    logs.push(`[DEBUG] EXCEPTION: ${error.message}`)
    logs.push(`[DEBUG] Stack: ${error.stack}`)
    return NextResponse.json({ logs, error: error.message }, { status: 500 })
  }
}
