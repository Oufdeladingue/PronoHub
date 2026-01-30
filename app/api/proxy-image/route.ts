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

    // Vérifier que le domaine est autorisé
    if (!ALLOWED_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
      return NextResponse.json({ error: 'Domaine non autorisé' }, { status: 403 })
    }

    // Récupérer l'image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PronoHub/1.0'
      }
    })

    if (!response.ok) {
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
