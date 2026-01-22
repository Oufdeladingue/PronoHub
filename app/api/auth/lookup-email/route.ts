import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Utiliser le client admin pour pouvoir lire les profiles sans authentification
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { username } = await request.json()

    if (!username) {
      return NextResponse.json({ error: 'Username requis' }, { status: 400 })
    }

    // Chercher le profil par username (insensible à la casse)
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    return NextResponse.json({ email: profile.email })
  } catch (error) {
    console.error('Lookup email error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
