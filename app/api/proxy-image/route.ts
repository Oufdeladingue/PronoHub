import { NextRequest, NextResponse } from 'next/server'

// Liste des domaines autorisés pour le proxy d'images
const ALLOWED_DOMAINS = [
  'crests.football-data.org',
  'media.api-sports.io',
]

/**
 * Proxy pour les images externes (contourne les restrictions CORS)
 * GET /api/proxy-image?url=https://crests.football-data.org/524.png
 */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
    }

    // Vérifier que l'URL est valide
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }

    // Forcer HTTPS (empêche http:// vers des cibles internes)
    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Schéma non autorisé' }, { status: 403 })
    }

    // Vérifier que le domaine est autorisé — égalité EXACTE (un .includes() laisserait
    // passer crests.football-data.org.attacker.com)
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Domaine non autorisé' }, { status: 403 })
    }

    // Récupérer l'image (pas de suivi de redirection : évite un rebond vers une cible interne)
    const response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      console.error('[proxy-image] Fetch failed:', url, 'Status:', response.status)
      return NextResponse.json({ error: 'Image non trouvée' }, { status: response.status })
    }

    // Récupérer le contenu et le type
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    // Retourner l'image avec les bons headers CORS
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache 24h
        'Access-Control-Allow-Origin': '*',
      }
    })
  } catch (error) {
    console.error('[proxy-image] Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
