import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isValidDiscordWebhook, postDiscordEmbed } from '@/lib/integrations/discord'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

/** Vérifie l'auth + que l'utilisateur est le créateur du tournoi. Retourne {userId, tournament} ou une erreur. */
async function requireCreator(tournamentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: t } = await admin
    .from('tournaments')
    .select('id, name, slug, invite_code, creator_id, discord_webhook_url')
    .eq('id', tournamentId)
    .maybeSingle()
  if (!t) return { error: NextResponse.json({ error: 'Tournoi introuvable' }, { status: 404 }) }
  if (t.creator_id !== user.id) return { error: NextResponse.json({ error: 'Réservé au créateur' }, { status: 403 }) }
  return { userId: user.id, tournament: t, admin }
}

// GET → état de connexion (créateur uniquement)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const r = await requireCreator(tournamentId)
  if (r.error) return r.error
  return NextResponse.json({ connected: !!r.tournament.discord_webhook_url })
}

// POST { webhookUrl } → enregistre + envoie un embed de test
export async function POST(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const r = await requireCreator(tournamentId)
  if (r.error) return r.error

  const { webhookUrl } = await req.json().catch(() => ({}))
  if (!isValidDiscordWebhook(webhookUrl)) {
    return NextResponse.json({ error: 'URL de webhook Discord invalide.' }, { status: 400 })
  }

  // Test immédiat AVANT d'enregistrer (on ne garde pas un webhook qui ne marche pas)
  const t = r.tournament
  const inviteUrl = `${BASE}/share/invite/${t.invite_code || t.slug}`
  const ok = await postDiscordEmbed(webhookUrl, {
    title: `🎮 Discord connecté à « ${t.name} »`,
    description: `Ce salon recevra maintenant les temps forts du tournoi : arrivées de joueurs, rappels avant les journées et classements.\n\n[Rejoindre le tournoi](${inviteUrl})`,
  })
  if (!ok) {
    return NextResponse.json({ error: 'Discord a refusé ce webhook (URL révoquée ou incorrecte ?).' }, { status: 400 })
  }

  const { error } = await r.admin.from('tournaments').update({ discord_webhook_url: webhookUrl.trim() }).eq('id', tournamentId)
  if (error) return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 })
  return NextResponse.json({ success: true, connected: true })
}

// DELETE → déconnecte
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params
  const r = await requireCreator(tournamentId)
  if (r.error) return r.error
  await r.admin.from('tournaments').update({ discord_webhook_url: null }).eq('id', tournamentId)
  return NextResponse.json({ success: true, connected: false })
}
