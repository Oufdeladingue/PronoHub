import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendDetailedReminderEmail } from '@/lib/email'

// API de test pour prévisualiser et envoyer des emails
// Usage: POST /api/email/test avec { type: 'reminder' }
// L'email est envoyé à l'adresse de l'utilisateur connecté

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

    // Récupérer le profil de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const { type } = body

    // L'email est toujours envoyé à l'adresse de l'utilisateur connecté
    const email = user.email
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Aucune adresse email associée à ce compte' },
        { status: 400 }
      )
    }

    if (type === 'reminder') {
      // Données de test pour l'email de rappel (avec le vrai username)
      const testData = {
        username: profile?.username || 'Joueur',
        tournamentName: 'Ligue des Champions 2024/25',
        tournamentSlug: 'ligue-des-champions-2024',
        competitionName: 'UEFA Champions League',
        matchdayName: 'Journée 6 - Phase de ligue',
        matches: [
          {
            homeTeam: 'Paris Saint-Germain',
            awayTeam: 'Manchester City',
            matchDate: 'Mercredi 11 décembre à 21h00',
            deadlineTime: '20h00'
          },
          {
            homeTeam: 'FC Barcelona',
            awayTeam: 'Borussia Dortmund',
            matchDate: 'Mercredi 11 décembre à 21h00',
            deadlineTime: '20h00'
          },
          {
            homeTeam: 'Bayern Munich',
            awayTeam: 'Slovan Bratislava',
            matchDate: 'Mercredi 11 décembre à 18h45',
            deadlineTime: '17h45'
          }
        ],
        defaultPredictionMaxPoints: 1
      }

      const result = await sendDetailedReminderEmail(email, testData)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Email de rappel de test envoyé à ${email}`,
        messageId: result.messageId
      })
    }

    return NextResponse.json(
      { success: false, error: `Type d'email non supporté: ${type}` },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Test email API error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
