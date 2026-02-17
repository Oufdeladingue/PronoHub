import { SupabaseClient } from '@supabase/supabase-js'

const MATCH_SHORTCODE_REGEX = /\[match_ID=([a-f0-9-]{36})\]/gi

function buildMatchCardHtml(match: {
  home_team_name: string
  away_team_name: string
  home_team_crest: string | null
  away_team_crest: string | null
}): string {
  const homeCrest = match.home_team_crest
    ? `<img src="${match.home_team_crest}" alt="${match.home_team_name}" width="32" height="32" style="display: block; margin: 0 auto 6px;" />`
    : `<div style="width: 32px; height: 32px; margin: 0 auto 6px; background-color: #1e293b; border-radius: 50%; text-align: center; line-height: 32px;"><span style="font-size: 16px;">⚽</span></div>`

  const awayCrest = match.away_team_crest
    ? `<img src="${match.away_team_crest}" alt="${match.away_team_name}" width="32" height="32" style="display: block; margin: 0 auto 6px;" />`
    : `<div style="width: 32px; height: 32px; margin: 0 auto 6px; background-color: #1e293b; border-radius: 50%; text-align: center; line-height: 32px;"><span style="font-size: 16px;">⚽</span></div>`

  return `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 12px 0; background-color: #0f172a; border-radius: 12px;">
  <tr>
    <td style="text-align: center; padding: 12px 8px; width: 40%;">
      ${homeCrest}
      <div style="font-size: 13px; color: #e0e0e0; font-weight: 500;">${match.home_team_name}</div>
    </td>
    <td style="text-align: center; vertical-align: middle; padding: 8px; width: 20%;">
      <div style="font-size: 16px; font-weight: 700; color: #ff9900;">VS</div>
    </td>
    <td style="text-align: center; padding: 12px 8px; width: 40%;">
      ${awayCrest}
      <div style="font-size: 13px; color: #e0e0e0; font-weight: 500;">${match.away_team_name}</div>
    </td>
  </tr>
</table>`
}

const MATCH_NOT_FOUND_HTML = `<div style="padding: 8px 16px; background-color: #1e293b; border-radius: 8px; color: #94a3b8; font-size: 12px; margin: 8px 0; text-align: center;">Match introuvable</div>`

/**
 * Remplace tous les shortcodes [match_ID=<uuid>] par des cartes HTML de matchs.
 * Exécute 1 seule requête Supabase pour tous les matchs référencés.
 */
export async function replaceMatchShortcodes(
  html: string,
  supabase: SupabaseClient
): Promise<string> {
  // Extraire tous les IDs de matchs uniques
  const matchIds = new Set<string>()
  let match: RegExpExecArray | null
  const regex = new RegExp(MATCH_SHORTCODE_REGEX.source, 'gi')
  while ((match = regex.exec(html)) !== null) {
    matchIds.add(match[1])
  }

  if (matchIds.size === 0) return html

  // Batch-fetch tous les matchs en 1 requête
  const { data: matches } = await supabase
    .from('imported_matches')
    .select('id, home_team_name, away_team_name, home_team_crest, away_team_crest')
    .in('id', Array.from(matchIds))

  const matchMap = new Map(
    (matches || []).map(m => [m.id, m])
  )

  // Remplacer chaque shortcode
  return html.replace(
    new RegExp(MATCH_SHORTCODE_REGEX.source, 'gi'),
    (fullMatch, matchId) => {
      const matchData = matchMap.get(matchId)
      if (!matchData) return MATCH_NOT_FOUND_HTML
      return buildMatchCardHtml(matchData)
    }
  )
}
