import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const BASE = 'https://www.pronohub.club'

type Params = { code: string }

interface Preview {
  name: string
  creator: string
  competition: string | null
  current: number
  max: number
  status: string
}

/** Récupère l'aperçu public d'un tournoi par son code (invite_code ou slug). */
async function getPreview(code: string): Promise<Preview | null> {
  try {
    const c = code.toUpperCase()
    const s = createAdminClient()
    const { data: t } = await s
      .from('tournaments')
      .select('id, name, status, max_players, creator_id, competition_id, custom_competition_id')
      .or(`invite_code.eq.${c},slug.eq.${code}`)
      .maybeSingle()
    if (!t) return null

    const [{ data: creator }, { count }] = await Promise.all([
      s.from('profiles').select('username').eq('id', t.creator_id).maybeSingle(),
      s.from('tournament_participants').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id),
    ])

    let competition: string | null = null
    if (t.custom_competition_id) {
      const { data: cc } = await s.from('custom_competitions').select('name').eq('id', t.custom_competition_id).maybeSingle()
      competition = cc?.name || null
    } else if (t.competition_id) {
      const { data: comp } = await s.from('competitions').select('name').eq('id', t.competition_id).maybeSingle()
      competition = comp?.name || null
    }

    return {
      name: t.name,
      creator: creator?.username || 'Un ami',
      competition,
      current: count || 0,
      max: t.max_players,
      status: t.status,
    }
  } catch {
    return null
  }
}

function ogUrl(p: Preview): string {
  const q = new URLSearchParams({ name: p.name, creator: p.creator, players: `${p.current}/${p.max}` })
  if (p.competition) q.set('competition', p.competition)
  return `${BASE}/api/og/invite?${q.toString()}`
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { code } = await params
  const p = await getPreview(code)
  if (!p) {
    return { title: 'Invitation · PronoHub', robots: { index: false, follow: true } }
  }
  const title = `${p.creator} t'invite sur "${p.name}" | PronoHub`
  const description = `Rejoins le tournoi de pronos "${p.name}"${p.competition ? ` sur ${p.competition}` : ''} et défie ${p.creator} & les autres. Gratuit.`
  const image = ogUrl(p)
  return {
    title,
    description,
    robots: { index: false, follow: true }, // lien privé de tournoi : pas d'indexation, mais aperçu social OK
    alternates: { canonical: `${BASE}/share/invite/${code}` },
    openGraph: { title, description, url: `${BASE}/share/invite/${code}`, type: 'website', images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  }
}

export default async function ShareInvitePage({ params }: { params: Promise<Params> }) {
  const { code } = await params
  const p = await getPreview(code)
  const joinUrl = `/vestiaire/rejoindre?code=${encodeURIComponent(code)}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-5 py-12" style={{ background: '#0f172a' }}>
      <a href="/" className="flex items-center gap-2 text-2xl font-black text-white">
        <span>⚽ Prono</span><span style={{ color: '#ff9900' }}>Hub</span>
      </a>

      {p ? (
        <>
          <p className="text-slate-300 text-center text-[15px]">
            <strong className="text-white">{p.creator}</strong> t'invite à rejoindre son tournoi de pronos 🏆
          </p>
          <div className="w-full max-w-md rounded-2xl border-2 border-[#ff9900]/70 bg-[#111827] p-6 text-center">
            <h1 className="text-2xl font-bold text-white mb-2">{p.name}</h1>
            <div className="flex items-center justify-center gap-4 text-sm text-slate-300">
              {p.competition && <span className="text-[#ff9900]">🏟️ {p.competition}</span>}
              <span>👥 {p.current}/{p.max} joueurs</span>
            </div>
          </div>
          <a
            href={joinUrl}
            className="inline-block bg-[#ff9900] text-[#111827] font-bold text-[17px] px-9 py-3.5 rounded-xl hover:brightness-110 transition"
          >
            Rejoindre le tournoi →
          </a>
          <p className="text-slate-500 text-xs text-center max-w-sm">
            Pronostique les matchs, marque des points, grimpe au classement et débloque des trophées. 100% gratuit.
          </p>
        </>
      ) : (
        <>
          <p className="text-slate-300 text-center">Ce lien d'invitation n'est plus valide ou le tournoi est introuvable.</p>
          <a href="/" className="inline-block bg-[#ff9900] text-[#111827] font-bold px-8 py-3.5 rounded-xl hover:brightness-110 transition">
            Crée ton tournoi gratuit →
          </a>
        </>
      )}
    </div>
  )
}
