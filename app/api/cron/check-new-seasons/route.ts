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
const SETTING_KEY = 'new_season_alerts_notified'
const MAX_CHECKS = 12 // borne le temps total (×6s) bien sous le timeout proxy ~100s
const DELAY_MS = 6000 // respect du rate limit football-data (10 req/min)

function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Cron de surveillance des nouvelles saisons des compétitions sources.
 *
 * Pour chaque compétition importée (table `competitions`), interroge football-data et compare
 * la saison COURANTE de la source à celle qu'on a importée (`current_season_start_date`).
 * Si la source a basculé sur une nouvelle saison (début > 60 j après le nôtre), envoie UN email
 * à l'admin. Anti-spam : on mémorise la dernière saison signalée par compétition (admin_settings)
 * pour ne pas ré-emailer chaque jour.
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

  // Compétitions à surveiller : ligues importées (id = id football-data), avec une saison connue
  const { data: comps, error: compErr } = await supabase
    .from('competitions')
    .select('id, name, current_season_start_date')
    .not('current_season_start_date', 'is', null)
    .order('id', { ascending: true })
    .limit(MAX_CHECKS)

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 })
  }

  // État des alertes déjà envoyées { [competitionId]: 'YYYY-MM-DD' }
  const { data: settingRow } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', SETTING_KEY)
    .maybeSingle()
  let notified: Record<string, string> = {}
  try { notified = settingRow?.setting_value ? JSON.parse(settingRow.setting_value) : {} } catch { notified = {} }

  const newSeasons: { id: number; name: string; importedStart: string; sourceStart: string; sourceEnd: string }[] = []
  const checked: number[] = []
  const errors: string[] = []

  for (let i = 0; i < (comps || []).length; i++) {
    const comp = comps![i]
    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS))
    try {
      const res = await fetch(`${FOOTBALL_DATA_API}/competitions/${comp.id}`, {
        headers: { 'X-Auth-Token': apiKey },
      })
      checked.push(comp.id)
      if (!res.ok) {
        if (res.status !== 404) errors.push(`${comp.id}: http ${res.status}`)
        continue
      }
      const j = await res.json()
      const sourceStart: string | undefined = j?.currentSeason?.startDate
      const sourceEnd: string | undefined = j?.currentSeason?.endDate
      if (!sourceStart) continue

      const importedStartMs = new Date(comp.current_season_start_date).getTime()
      const sourceStartMs = new Date(sourceStart).getTime()

      // Nouvelle saison disponible côté source ?
      if (sourceStartMs - importedStartMs >= NEW_SEASON_MIN_GAP_MS) {
        // Anti-spam : déjà signalé pour cette même saison ?
        if (notified[String(comp.id)] === sourceStart) continue
        newSeasons.push({
          id: comp.id,
          name: comp.name,
          importedStart: new Date(comp.current_season_start_date).toISOString().slice(0, 10),
          sourceStart,
          sourceEnd: sourceEnd || '?',
        })
      }
    } catch (e: any) {
      errors.push(`${comp.id}: ${e.message}`)
    }
  }

  // Envoi de l'email si nouvelles saisons détectées (non encore signalées)
  let emailed = false
  if (newSeasons.length > 0) {
    const rows = newSeasons.map((s) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;"><strong>${escapeHtml(s.name)}</strong> <span style="color:#888;">(#${s.id})</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold;">${escapeHtml(s.sourceStart)} → ${escapeHtml(s.sourceEnd)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;color:#888;">${escapeHtml(s.importedStart)}</td>
      </tr>`).join('')
    const html = `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;">
        <h2 style="color:#ff9900;">⚽ Nouvelle(s) saison(s) disponible(s) sur football-data</h2>
        <p>Les compétitions suivantes ont une nouvelle saison publiée à la source, plus récente que celle importée dans PronoHub :</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="text-align:left;color:#555;">
            <th style="padding:8px;">Compétition</th>
            <th style="padding:8px;">Nouvelle saison (source)</th>
            <th style="padding:8px;">Saison importée</th>
          </tr>
          ${rows}
        </table>
        <p style="margin-top:16px;">👉 Tu peux maintenant <strong>ré-importer</strong> ces compétitions depuis le panel admin (Données / Compétitions) pour activer la nouvelle saison, puis créer les nouvelles journées Best of Week associées.</p>
        <p style="color:#888;font-size:12px;">Cet email n'est envoyé qu'une fois par nouvelle saison détectée (anti-doublon).</p>
      </div>`
    const text = `Nouvelle(s) saison(s) disponible(s) sur football-data :\n` +
      newSeasons.map((s) => `- ${s.name} (#${s.id}) : ${s.sourceStart} → ${s.sourceEnd} (importé : ${s.importedStart})`).join('\n') +
      `\n\nRé-importe ces compétitions depuis le panel admin pour activer la nouvelle saison.`

    const result = await sendEmail(ADMIN_EMAIL, `⚽ ${newSeasons.length} nouvelle(s) saison(s) disponible(s) — PronoHub`, html, text)
    emailed = result.success

    // Mémoriser pour ne pas ré-emailer la même saison
    if (result.success) {
      for (const s of newSeasons) notified[String(s.id)] = s.sourceStart
      await supabase
        .from('admin_settings')
        .upsert({ setting_key: SETTING_KEY, setting_value: JSON.stringify(notified) }, { onConflict: 'setting_key' })
    }
  }

  return NextResponse.json({
    success: true,
    checked: checked.length,
    newSeasons,
    emailed,
    errors: errors.length ? errors : undefined,
  })
}
