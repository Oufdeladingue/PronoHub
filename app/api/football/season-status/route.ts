import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Une nouvelle saison = début au moins 60 j après celui qu'on a importé (évite les faux positifs
// dus à un simple ajustement de calendrier intra-saison).
const NEW_SEASON_MIN_GAP_MS = 60 * 24 * 60 * 60 * 1000

/**
 * GET /api/football/season-status?competitionId=2015
 * Compare la saison COURANTE de football-data à celle déjà importée pour cette compétition.
 * Sert à vérifier, AVANT de ré-importer, qu'une nouvelle saison est bien disponible à la source.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')
    if (!competitionId) return NextResponse.json({ error: 'competitionId requis' }, { status: 400 })

    const apiKey = process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé API football-data non configurée' }, { status: 500 })

    // Saison déjà importée chez nous
    const { data: comp } = await supabase
      .from('competitions')
      .select('name, current_season_start_date, current_season_end_date')
      .eq('id', parseInt(competitionId))
      .maybeSingle()

    // Saison courante côté source
    const res = await fetch(`${FOOTBALL_DATA_API}/competitions/${competitionId}`, {
      headers: { 'X-Auth-Token': apiKey },
    })
    if (!res.ok) {
      return NextResponse.json({ error: `football-data: HTTP ${res.status}` }, { status: 502 })
    }
    const j = await res.json()
    const sourceStart: string | null = j?.currentSeason?.startDate ?? null
    const sourceEnd: string | null = j?.currentSeason?.endDate ?? null
    const sourceMatchday: number | null = j?.currentSeason?.currentMatchday ?? null

    const importedStart: string | null = comp?.current_season_start_date
      ? new Date(comp.current_season_start_date).toISOString().slice(0, 10)
      : null

    let hasNewSeason = false
    if (sourceStart && importedStart) {
      hasNewSeason = (new Date(sourceStart).getTime() - new Date(importedStart).getTime()) >= NEW_SEASON_MIN_GAP_MS
    } else if (sourceStart && !importedStart) {
      // Jamais importée → on considère qu'il y a une saison à importer
      hasNewSeason = true
    }

    return NextResponse.json({
      competitionId: parseInt(competitionId),
      name: comp?.name || j?.name || null,
      importedStart,
      importedEnd: comp?.current_season_end_date ? new Date(comp.current_season_end_date).toISOString().slice(0, 10) : null,
      sourceStart,
      sourceEnd,
      sourceMatchday,
      hasNewSeason,
      neverImported: !importedStart,
    })
  } catch (error: any) {
    console.error('[season-status] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
