import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      )
    }

    // Récupérer le profil pour avoir le username
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, email')
      .eq('id', user.id)
      .single()

    const email = profile?.email || user.email
    const username = profile?.username

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email non disponible' },
        { status: 400 }
      )
    }

    // Envoyer l'email de bienvenue
    const result = await sendWelcomeEmail(email, { username })

    if (!result.success) {
      console.error('Failed to send welcome email:', result.error)
      return NextResponse.json(
        { success: false, error: 'Échec de l\'envoi de l\'email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Email de bienvenue envoyé'
    })
  } catch (error: any) {
    console.error('Welcome email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
