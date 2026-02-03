import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''

  // Rediriger pronohub.club vers www.pronohub.club pour cohérence des cookies
  // Aussi gérer le cas où le port interne (3000) est exposé
  if (host === 'pronohub.club' || host.startsWith('pronohub.club:') ||
      host === 'www.pronohub.club:3000' || host.startsWith('www.pronohub.club:')) {
    // Construire l'URL de redirection proprement sans utiliser request.url
    const pathname = request.nextUrl.pathname
    const search = request.nextUrl.search
    const redirectUrl = `https://www.pronohub.club${pathname}${search}`
    return NextResponse.redirect(redirectUrl, 301)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
