import { NextRequest, NextResponse } from 'next/server'

/**
 * Page de statut de suppression des données Facebook
 * Retourne un simple JSON confirmant que les données ont été supprimées
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.json(
      { error: 'Code de confirmation manquant' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    status: 'completed',
    message: 'Les données associées à votre compte Facebook ont été supprimées de PronoHub.',
    confirmation_code: code,
  })
}
