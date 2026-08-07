import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pronohub.club'

/** Logo PronoHub → data URI (fetch de l'URL absolue : robuste même en build standalone). */
async function logoDataUri(): Promise<string | null> {
  try {
    const r = await fetch(`${BASE}/images/logo.png`)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/** Emblème compétition (souvent SVG) → PNG via img-proxy → data URI. Best-effort. */
async function emblemDataUri(emblem: string | null): Promise<string | null> {
  if (!emblem) return null
  try {
    const proxied = `${BASE}/api/img-proxy?url=${encodeURIComponent(emblem)}&size=160`
    const r = await fetch(proxied)
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * OG image dynamique d'un lien d'invitation à un tournoi (aperçu riche WhatsApp/réseaux).
 * Params : name (tournoi), creator (pseudo), players ("3/10"), competition, emblem (URL logo compétition).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') === 'en' ? 'en' : 'fr'
  const L = locale === 'en'
    ? {
        defaultName: 'a prediction tournament',
        defaultCreator: 'A friend',
        invitesYou: 'invites you to',
        theirTournament: 'their prediction tournament 🏆',
        players: 'players',
        joinCta: 'Join the tournament  →',
        tagline: 'pronohub.club — football predictions with friends, free',
      }
    : {
        defaultName: 'un tournoi de pronos',
        defaultCreator: 'Un ami',
        invitesYou: "t'invite à",
        theirTournament: 'son tournoi de pronos 🏆',
        players: 'joueurs',
        joinCta: 'Rejoins le tournoi  →',
        tagline: 'pronohub.club — pronos foot entre potes, gratuit',
      }
  const name = (searchParams.get('name') || L.defaultName).slice(0, 60)
  const creator = (searchParams.get('creator') || L.defaultCreator).slice(0, 30)
  const players = (searchParams.get('players') || '').slice(0, 10)
  const competition = (searchParams.get('competition') || '').slice(0, 40)
  const emblem = searchParams.get('emblem')

  const interBold = fetch(
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff'
  ).then((res) => res.arrayBuffer())

  const [logo, emblemImg] = await Promise.all([logoDataUri(), emblemDataUri(emblem)])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 55%, #0a0a0a 100%)',
          fontFamily: 'Inter',
          padding: '40px 60px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 620,
            height: 620,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,153,0,0.18) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Logo PronoHub */}
        {logo ? (
          <img src={logo} height={46} style={{ height: 46, marginBottom: 14 }} alt="" />
        ) : (
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, marginBottom: 14 }}>
            <span style={{ color: '#ffffff' }}>Prono</span>
            <span style={{ color: '#ff9900' }}>Hub</span>
          </div>
        )}

        {/* Accroche */}
        <div style={{ display: 'flex', fontSize: 36, color: '#94a3b8', marginBottom: 2 }}>
          {creator} {L.invitesYou}
        </div>
        <div style={{ display: 'flex', fontSize: 26, color: '#94a3b8', marginBottom: 16 }}>
          {L.theirTournament}
        </div>

        {/* Carte tournoi */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(30, 41, 59, 0.65)',
            border: '2px solid #ff9900',
            borderRadius: 22,
            padding: '22px 46px',
            maxWidth: 1000,
          }}
        >
          {emblemImg ? (
            <img src={emblemImg} width={72} height={72} style={{ objectFit: 'contain' }} alt="" />
          ) : null}
          <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
            {name}
          </div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 26, color: '#e0e0e0' }}>
            {competition ? <span style={{ display: 'flex', color: '#ff9900' }}>{competition}</span> : null}
            {players ? <span style={{ display: 'flex' }}>👥 {players} {L.players}</span> : null}
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 24,
            background: 'linear-gradient(180deg, #ffb43d 0%, #ff9900 100%)',
            color: '#111827',
            fontSize: 30,
            fontWeight: 800,
            padding: '18px 54px',
            borderRadius: 999,
            boxShadow: '0 10px 30px rgba(255,153,0,0.45)',
          }}
        >
          {L.joinCta}
        </div>

        <div style={{ display: 'flex', marginTop: 20, fontSize: 18, color: '#64748b' }}>
          {L.tagline}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Inter', data: await interBold, style: 'normal', weight: 700 }],
    }
  )
}
