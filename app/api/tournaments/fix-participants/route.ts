import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'Slug requis' }, { status: 400 })
    }

    // Récupérer le tournoi
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('slug', slug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournoi non trouvé' }, { status: 404 })
    }

    // Vérifier si le créateur a un profil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', tournament.creator_id)
      .single()

    // Vérifier si le créateur est déjà participant
    const { data: existingParticipant } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('user_id', tournament.creator_id)
      .single()

    const diagnostics = {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        creator_id: tournament.creator_id
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      existingParticipant: existingParticipant || null,
      needsFix: !existingParticipant && !!profile
    }

    // Si on peut fix, on le fait
    if (diagnostics.needsFix) {
      const { error: insertError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          user_id: tournament.creator_id
        })

      if (insertError) {
        return NextResponse.json({
          ...diagnostics,
          fixAttempted: true,
          fixSuccess: false,
          fixError: insertError.message
        })
      }

      return NextResponse.json({
        ...diagnostics,
        fixAttempted: true,
        fixSuccess: true
      })
    }

    return NextResponse.json(diagnostics)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
