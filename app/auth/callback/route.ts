import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')
  const origin = requestUrl.origin

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Rediriger vers le dashboard (la modale de choix de pseudo s'affichera si nécessaire)
  const finalRedirect = redirectTo ? decodeURIComponent(redirectTo) : '/dashboard'
  return NextResponse.redirect(`${origin}${finalRedirect}`)
}
