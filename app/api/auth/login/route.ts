import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkRateLimit, RATE_LIMITS, getClientIP } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    // Rate limiting - protection contre les attaques par force brute
    const clientIP = getClientIP(request)
    const rateLimitResult = checkRateLimit(`login:${clientIP}`, RATE_LIMITS.login)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Trop de tentatives de connexion. Réessayez dans quelques minutes.' },
        { status: 429 }
      )
    }

    const { identifier, password } = await request.json()

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifiant et mot de passe requis' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    let email = identifier

    // Vérifier si l'identifiant est un email ou un username
    const isEmail = identifier.includes('@')

    if (!isEmail) {
      // C'est un username, on récupère l'email correspondant
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', identifier)
        .single()

      if (profileError || !profile) {
        return NextResponse.json(
          { error: 'Identifiant ou mot de passe incorrect' },
          { status: 401 }
        )
      }

      email = profile.email
    }

    // Se connecter avec l'email
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: 'Identifiant ou mot de passe incorrect' },
        { status: 401 }
      )
    }

    // Récupérer le rôle de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    return NextResponse.json({
      success: true,
      user: data.user,
      role: profile?.role || 'user'
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la connexion' },
      { status: 500 }
    )
  }
}
