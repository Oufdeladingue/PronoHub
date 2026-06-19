import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
const NEW_SEASON_MIN_GAP_MS = 60 * 24 * 60 * 60 * 1000

/**
 * GET /api/football/seasons-overview
 * En UN SEUL appel football-data (/competitions), renvoie pour chaque compétition importée si une
 * NOUVELLE saison est disponible à la source (comparée à la saison importée). Sert à afficher
 * l'état directement sur les cartes admin (message + bouton grisé) sans 1 appel par compétition.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const apiKey = process.env.FOOTBALL_DATA_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Clé API football-data non configurée' }, { status: 500 })

    // Nos saisons importées
    const { data: comps } = await supabase
      .from('competitions')
      .select('id, current_season_start_date')

    const importedStartById = new Map<number, number | null>()
    for (const c of comps || []) {
      importedStartById.set(c.id, c.current_season_start_date ? new Date(c.current_season_start_date).getTime() : null)
    }

    // 1 seul appel : la liste des compétitions de l'abonnement, avec leur saison courante
    const res = await fetch(`${FOOTBALL_DATA_API}/competitions`, { headers: { 'X-Auth-Token': apiKey } })
    if (!res.ok) return NextResponse.json({ error: `football-data: HTTP ${res.status}` }, { status: 502 })
    const j = await res.json()

    const overview: Record<number, { hasNewSeason: boolean; sourceStart: string | null; sourceEnd: string | null }> = {}
    for (const c of j?.competitions || []) {
      if (!importedStartById.has(c.id)) continue // on ne s'intéresse qu'aux compétitions importées
      const sourceStart: string | null = c?.currentSeason?.startDate ?? null
      const sourceEnd: string | null = c?.currentSeason?.endDate ?? null
      const importedStart = importedStartById.get(c.id) ?? null
      let hasNewSeason = false
      if (sourceStart && importedStart != null) {
        hasNewSeason = (new Date(sourceStart).getTime() - importedStart) >= NEW_SEASON_MIN_GAP_MS
      } else if (sourceStart && importedStart == null) {
        hasNewSeason = true
      }
      overview[c.id] = { hasNewSeason, sourceStart, sourceEnd }
    }

    return NextResponse.json({ overview })
  } catch (error: any) {
    console.error('[seasons-overview] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
