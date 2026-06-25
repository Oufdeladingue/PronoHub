import { NextResponse } from 'next/server'
import sharp from 'sharp'

/**
 * Proxy d'image → PNG same-origin. Rasterise notamment les blasons/emblèmes SVG (football-data
 * sert des .svg sans dimension intrinsèque, que <canvas> ne sait pas dessiner) pour l'export vidéo.
 * Garde anti-SSRF : allowlist d'hôtes stricte.
 */
const ALLOWED_HOSTS = new Set<string>([
  'crests.football-data.org',
  'media.api-sports.io',
])
// Hôte Supabase Storage (emblèmes custom) dérivé de l'URL projet
try {
  const h = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname
  if (h) ALLOWED_HOSTS.add(h)
} catch { /* noop */ }

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const url = sp.get('url')
  if (!url) return new NextResponse('missing url', { status: 400 })

  let host: string
  try { host = new URL(url).hostname } catch { return new NextResponse('bad url', { status: 400 }) }
  if (!ALLOWED_HOSTS.has(host)) return new NextResponse('host not allowed', { status: 403 })

  const size = Math.min(256, Math.max(16, parseInt(sp.get('size') || '64', 10) || 64))

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'PronoHub-img-proxy' } })
    if (!res.ok) return new NextResponse('fetch failed', { status: 502 })
    const buf = Buffer.from(await res.arrayBuffer())
    // density élevée pour un rendu net des SVG ; fond transparent ; "contain" pour garder le ratio
    const png = await sharp(buf, { density: 300 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    return new NextResponse(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800, immutable' },
    })
  } catch (e: any) {
    return new NextResponse('error: ' + e.message, { status: 500 })
  }
}
