import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Utiliser l'URL de l'app configurée ou construire depuis la requête
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return NextResponse.redirect(appUrl, { status: 303 })
}

// Gérer aussi les requêtes GET pour éviter les erreurs 405
export async function GET(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  return NextResponse.redirect(appUrl, { status: 303 })
}
