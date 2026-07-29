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
  const name = (searchParams.get('name') || 'un tournoi de pronos').slice(0, 60)
  const creator = (searchParams.get('creator') || 'Un ami').slice(0, 30)
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
          padding: '44px 60px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '46%',
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
          <img src={logo} height={52} style={{ height: 52, marginBottom: 16 }} alt="" />
        ) : (
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, marginBottom: 16 }}>
            <span style={{ color: '#ffffff' }}>Prono</span>
            <span style={{ color: '#ff9900' }}>Hub</span>
          </div>
        )}

        {/* Accroche */}
        <div style={{ display: 'flex', fontSize: 40, color: '#94a3b8', marginBottom: 4 }}>
          {creator} t'invite à
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#94a3b8', marginBottom: 18 }}>
          son tournoi de pronos 🏆
        </div>

        {/* Carte tournoi */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(30, 41, 59, 0.65)',
            border: '2px solid #ff9900',
            borderRadius: 24,
            padding: '26px 48px',
            maxWidth: 980,
          }}
        >
          {emblemImg ? (
            <img src={emblemImg} width={92} height={92} style={{ objectFit: 'contain' }} alt="" />
          ) : null}
          <div style={{ display: 'flex', fontSize: 58, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
            {name}
          </div>
          <div style={{ display: 'flex', gap: 26, alignItems: 'center', fontSize: 27, color: '#e0e0e0' }}>
            {competition ? <span style={{ display: 'flex', color: '#ff9900' }}>{competition}</span> : null}
            {players ? <span style={{ display: 'flex' }}>👥 {players} joueurs</span> : null}
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            background: '#ff9900',
            color: '#111827',
            fontSize: 30,
            fontWeight: 700,
            padding: '16px 44px',
            borderRadius: 16,
          }}
        >
          Rejoins le tournoi →
        </div>

        <div style={{ position: 'absolute', bottom: 26, fontSize: 20, color: '#64748b', display: 'flex' }}>
          pronohub.club — pronos foot entre potes, gratuit
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
