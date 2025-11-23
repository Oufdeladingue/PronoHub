import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/tournaments/[tournamentId]/branding
// Retourne les informations de branding entreprise pour un tournoi
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    // Verifier que le tournoi existe et est de type entreprise
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, tournament_type')
      .eq('id', tournamentId)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournoi non trouve' },
        { status: 404 }
      )
    }

    // Si ce n'est pas un tournoi entreprise, pas de branding
    if (tournament.tournament_type !== 'enterprise') {
      return NextResponse.json({
        success: true,
        branding: null,
      })
    }

    // Recuperer le branding entreprise
    const { data: branding, error: brandingError } = await supabase
      .from('enterprise_accounts')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'active')
      .single()

    if (brandingError) {
      return NextResponse.json({
        success: true,
        branding: null,
      })
    }

    return NextResponse.json({
      success: true,
      branding: {
        company_name: branding.company_name,
        custom_logo_url: branding.custom_logo_url,
        primary_color: branding.primary_color,
        secondary_color: branding.secondary_color,
      },
    })

  } catch (error) {
    console.error('Error fetching branding:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// PUT /api/tournaments/[tournamentId]/branding
// Met a jour le branding entreprise (reserve au proprietaire)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    // Verifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifie' },
        { status: 401 }
      )
    }

    // Verifier que l'utilisateur est le proprietaire du compte entreprise
    const { data: enterprise, error: enterpriseError } = await supabase
      .from('enterprise_accounts')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (enterpriseError || !enterprise) {
      return NextResponse.json(
        { success: false, error: 'Acces non autorise' },
        { status: 403 }
      )
    }

    // Recuperer les nouvelles donnees
    const body = await request.json()
    const { custom_logo_url, primary_color, secondary_color, company_name } = body

    // Mettre a jour le branding
    const { error: updateError } = await supabase
      .from('enterprise_accounts')
      .update({
        custom_logo_url,
        primary_color,
        secondary_color,
        company_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', enterprise.id)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la mise a jour' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Branding mis a jour',
    })

  } catch (error) {
    console.error('Error updating branding:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
