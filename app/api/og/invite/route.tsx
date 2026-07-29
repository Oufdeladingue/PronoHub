import { ImageResponse } from 'next/og'

export const runtime = 'edge'

/**
 * OG image dynamique pour un lien d'invitation à un tournoi (aperçu riche sur WhatsApp/réseaux).
 * Params : name (tournoi), creator (pseudo), players ("3/10"), competition (optionnel).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = (searchParams.get('name') || 'un tournoi de pronos').slice(0, 60)
  const creator = (searchParams.get('creator') || 'Un ami').slice(0, 30)
  const players = (searchParams.get('players') || '').slice(0, 10)
  const competition = (searchParams.get('competition') || '').slice(0, 40)

  const interBold = fetch(
    'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff'
  ).then((res) => res.arrayBuffer())

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
          padding: '48px 60px',
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

        {/* Marque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 30, fontWeight: 700 }}>
          <span style={{ color: '#ffffff' }}>⚽ Prono</span>
          <span style={{ color: '#ff9900' }}>Hub</span>
        </div>

        {/* Accroche */}
        <div style={{ display: 'flex', fontSize: 40, color: '#94a3b8', marginBottom: 6 }}>
          {creator} t'invite à
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#94a3b8', marginBottom: 18 }}>
          son tournoi de pronos 🏆
        </div>

        {/* Carte tournoi */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            background: 'rgba(30, 41, 59, 0.65)',
            border: '2px solid #ff9900',
            borderRadius: 24,
            padding: '30px 48px',
            maxWidth: 980,
          }}
        >
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
            {name}
          </div>
          <div style={{ display: 'flex', gap: 26, alignItems: 'center', fontSize: 28, color: '#e0e0e0' }}>
            {competition ? <span style={{ display: 'flex', color: '#ff9900' }}>🏟️ {competition}</span> : null}
            {players ? <span style={{ display: 'flex' }}>👥 {players} joueurs</span> : null}
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            display: 'flex',
            marginTop: 30,
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

        <div style={{ position: 'absolute', bottom: 28, fontSize: 20, color: '#64748b', display: 'flex' }}>
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
