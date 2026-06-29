import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { assertCron } from '@/lib/cron-auth'
import { sendEmail } from '@/lib/email/send'
import { ADMIN_EMAIL } from '@/lib/email/admin-templates'

const FOOTBALL_DATA_API = 'https://api.football-data.org/v4'
// Seuil pour considérer qu'il s'agit d'une VRAIE nouvelle saison (et non un ajustement de
// calendrier intra-saison) : la nouvelle date de début doit être au moins 60 jours après celle
// qu'on a importée.
const NEW_SEASON_MIN_GAP_MS = 60 * 24 * 60 * 60 * 1000
const SETTING_KEY = 'new_season_alerts_notified'            // { [competitionId]: 'YYYY-MM-DD' }
const COMP_SETTING_KEY = 'known_plan_competitions'           // [id, id, ...] baseline des compétitions du plan

function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Cron de surveillance des compétitions sources (football-data).
 *
 * Un SEUL appel à `/v4/competitions` (qui contient déjà `currentSeason` pour chaque compétition
 * du plan) sert aux deux vérifications :
 *
 *  1. NOUVELLE SAISON d'une compétition DÉJÀ importée (table `competitions`) : si la saison
 *     courante côté source débute ≥ 60 j après celle qu'on a importée → email admin.
 *     Anti-spam : on mémorise la dernière saison signalée par compétition (`new_season_alerts_notified`).
 *
 *  2. NOUVELLE COMPÉTITION ajoutée au plan football-data et absente de notre DB → email admin.
 *     Baseline : au 1er run on enregistre la liste actuelle SANS alerter (les compétitions déjà
 *     dispo mais non importées ne sont pas « nouvelles »). Ensuite, tout ID inédit déclenche l'alerte.
 *     Mémoire : `known_plan_competitions`.
 *
 * Auth : Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const denied = assertCron(request)
  if (denied) return denied

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Football Data API key not configured' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // --- Liste complète des compétitions du plan (1 appel, contient currentSeason) ---
  const listRes = await fetch(`${FOOTBALL_DATA_API}/competitions`, { headers: { 'X-Auth-Token': apiKey } })
  if (!listRes.ok) {
    return NextResponse.json({ error: `football-data /competitions http ${listRes.status}` }, { status: 502 })
  }
  const listJson = await listRes.json()
  const planComps: any[] = listJson?.competitions || []
  const planById = new Map<number, any>(planComps.map((c) => [c.id, c]))

  // --- Nos compétitions ---
  const { data: comps, error: compErr } = await supabase
    .from('competitions')
    .select('id, name, current_season_start_date')
  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 })
  }
  const dbIds = new Set<number>((comps || []).map((c) => c.id))

  // ========== 1. Nouvelles saisons des compétitions connues ==========
  const { data: seasonRow } = await supabase
    .from('admin_settings').select('setting_value').eq('setting_key', SETTING_KEY).maybeSingle()
  let notified: Record<string, string> = {}
  try { notified = seasonRow?.setting_value ? JSON.parse(seasonRow.setting_value) : {} } catch { notified = {} }

  const newSeasons: { id: number; name: string; importedStart: string; sourceStart: string; sourceEnd: string }[] = []
  for (const comp of comps || []) {
    if (!comp.current_season_start_date) continue
    const src = planById.get(comp.id)
    const sourceStart: string | undefined = src?.currentSeason?.startDate
    const sourceEnd: string | undefined = src?.currentSeason?.endDate
    if (!sourceStart) continue
    const gap = new Date(sourceStart).getTime() - new Date(comp.current_season_start_date).getTime()
    if (gap >= NEW_SEASON_MIN_GAP_MS) {
      if (notified[String(comp.id)] === sourceStart) continue // déjà signalé
      newSeasons.push({
        id: comp.id,
        name: comp.name,
        importedStart: new Date(comp.current_season_start_date).toISOString().slice(0, 10),
        sourceStart,
        sourceEnd: sourceEnd || '?',
      })
    }
  }

  // ========== 2. Nouvelles compétitions du plan absentes de la DB ==========
  const { data: compRow } = await supabase
    .from('admin_settings').select('setting_value').eq('setting_key', COMP_SETTING_KEY).maybeSingle()
  let knownPlanIds: number[] | null = null
  if (compRow?.setting_value) {
    try { knownPlanIds = JSON.parse(compRow.setting_value) } catch { knownPlanIds = null }
  }
  const planIds = planComps.map((c) => c.id)
  const isFirstRun = knownPlanIds === null
  const knownSet = new Set<number>(knownPlanIds || [])

  // « Nouvelle » = présente dans le plan, absente de notre DB, et ID jamais vu auparavant.
  // Au 1er run on ne signale rien (baseline) : les compétitions déjà dispo ne sont pas nouvelles.
  const newCompetitions = isFirstRun
    ? []
    : planComps.filter((c) => !dbIds.has(c.id) && !knownSet.has(c.id))

  // ========== Email (sections combinées) ==========
  let emailed = false
  if (newSeasons.length > 0 || newCompetitions.length > 0) {
    let html = `<div style="font-family:sans-serif;max-width:660px;margin:0 auto;">`
    let text = ''

    if (newSeasons.length > 0) {
      const rows = newSeasons.map((s) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${escapeHtml(s.name)}</strong> <span style="color:#888;">(#${s.id})</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold;">${escapeHtml(s.sourceStart)} → ${escapeHtml(s.sourceEnd)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#888;">${escapeHtml(s.importedStart)}</td>
        </tr>`).join('')
      html += `
        <h2 style="color:#ff9900;">⚽ Nouvelle(s) saison(s) disponible(s)</h2>
        <p>Compétitions <strong>déjà dans PronoHub</strong> dont la source a publié une saison plus récente :</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="text-align:left;color:#555;"><th style="padding:8px;">Compétition</th><th style="padding:8px;">Nouvelle saison (source)</th><th style="padding:8px;">Saison importée</th></tr>
          ${rows}
        </table>
        <p style="margin-top:12px;">👉 <strong>Ré-importe</strong> ces compétitions depuis le panel admin (Données / Compétitions) pour activer la nouvelle saison, puis crée les journées Best of Week associées.</p>`
      text += `Nouvelle(s) saison(s) disponible(s) :\n` +
        newSeasons.map((s) => `- ${s.name} (#${s.id}) : ${s.sourceStart} → ${s.sourceEnd} (importé : ${s.importedStart})`).join('\n') + `\n\n`
    }

    if (newCompetitions.length > 0) {
      const rows = newCompetitions.map((c) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${escapeHtml(c.name)}</strong> <span style="color:#888;">(#${c.id} · ${escapeHtml(c.code || '?')})</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#888;">${escapeHtml(c.area?.name || '?')}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;">${escapeHtml(c.currentSeason?.startDate || '?')} → ${escapeHtml(c.currentSeason?.endDate || '?')}</td>
        </tr>`).join('')
      html += `
        <h2 style="color:#ff9900;margin-top:24px;">🆕 Nouvelle(s) compétition(s) disponible(s) dans le plan</h2>
        <p>Compétitions exposées par football-data <strong>mais absentes de PronoHub</strong> :</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="text-align:left;color:#555;"><th style="padding:8px;">Compétition</th><th style="padding:8px;">Zone</th><th style="padding:8px;">Saison source</th></tr>
          ${rows}
        </table>
        <p style="margin-top:12px;">👉 Tu peux les <strong>importer</strong> depuis le panel admin si tu veux les proposer.</p>`
      text += `Nouvelle(s) compétition(s) dispo dans le plan :\n` +
        newCompetitions.map((c) => `- ${c.name} (#${c.id} ${c.code}) : ${c.currentSeason?.startDate} → ${c.currentSeason?.endDate}`).join('\n') + `\n\n`
    }

    html += `<p style="color:#888;font-size:12px;margin-top:16px;">Email envoyé une seule fois par nouveauté détectée (anti-doublon).</p></div>`

    const subjectBits: string[] = []
    if (newSeasons.length) subjectBits.push(`${newSeasons.length} saison(s)`)
    if (newCompetitions.length) subjectBits.push(`${newCompetitions.length} compétition(s)`)
    const result = await sendEmail(ADMIN_EMAIL, `⚽ Nouveautés football-data : ${subjectBits.join(' + ')} — PronoHub`, html, text)
    emailed = result.success

    if (result.success) {
      // Mémoriser les saisons signalées
      if (newSeasons.length > 0) {
        for (const s of newSeasons) notified[String(s.id)] = s.sourceStart
        await supabase.from('admin_settings')
          .upsert({ setting_key: SETTING_KEY, setting_value: JSON.stringify(notified) }, { onConflict: 'setting_key' })
      }
    }
  }

  // Mettre à jour la baseline des compétitions du plan (toujours, même sans email) : on enregistre
  // l'union des IDs connus + ceux du plan actuel → les « nouvelles » alertées ne re-déclenchent plus.
  const updatedKnown = Array.from(new Set<number>([...(knownPlanIds || []), ...planIds])).sort((a, b) => a - b)
  await supabase.from('admin_settings')
    .upsert({ setting_key: COMP_SETTING_KEY, setting_value: JSON.stringify(updatedKnown) }, { onConflict: 'setting_key' })

  return NextResponse.json({
    success: true,
    planCompetitions: planComps.length,
    dbCompetitions: dbIds.size,
    newSeasons,
    newCompetitions: newCompetitions.map((c) => ({ id: c.id, name: c.name })),
    baselineSeeded: isFirstRun,
    emailed,
  })
}
