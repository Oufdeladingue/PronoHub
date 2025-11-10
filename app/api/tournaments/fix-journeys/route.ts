import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Récupérer tous les tournois
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('id, num_matchdays, matchdays_count')

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError)
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la récupération des tournois' },
        { status: 500 }
      )
    }

    let fixedCount = 0
    const errors = []

    for (const tournament of tournaments || []) {
      const numMatchdays = tournament.num_matchdays || tournament.matchdays_count || 0

      if (numMatchdays === 0) continue

      // Vérifier si des journées existent déjà
      const { data: existingJourneys } = await supabase
        .from('tournament_journeys')
        .select('id')
        .eq('tournament_id', tournament.id)

      // Si des journées existent déjà, on passe au suivant
      if (existingJourneys && existingJourneys.length > 0) continue

      // Créer les journées manquantes
      const journeys = []
      for (let i = 1; i <= numMatchdays; i++) {
        journeys.push({
          tournament_id: tournament.id,
          journey_number: i,
          status: 'pending'
        })
      }

      const { error: journeysError } = await supabase
        .from('tournament_journeys')
        .insert(journeys)

      if (journeysError) {
        console.error(`Error creating journeys for tournament ${tournament.id}:`, journeysError)
        errors.push({
          tournamentId: tournament.id,
          error: journeysError.message
        })
      } else {
        fixedCount++
      }
    }

    return NextResponse.json({
      success: true,
      fixedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${fixedCount} tournoi(s) mis à jour avec succès`
    })

  } catch (error: any) {
    console.error('Error fixing tournament journeys:', error)
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
