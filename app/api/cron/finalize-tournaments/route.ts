import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { recalculateTournamentEndingDate } from '@/lib/tournament-duration'
import { assertCron } from '@/lib/cron-auth'

/**
 * Cron de finalisation automatique des tournois
 *
 * Ce cron s'exécute régulièrement pour :
 * 1. Détecter les tournois actifs dont la ending_date est dépassée
 * 2. Vérifier que tous les matchs sont bien terminés
 * 3. Finaliser le tournoi (status = 'completed')
 * 4. Si des matchs ne sont pas terminés, recalculer la ending_date
 *
 * Déclenchement : toutes les heures via GitHub Actions ou Vercel Cron
 */

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'autorisation (secret de cron, timing-safe + exige CRON_SECRET défini)
    const denied = assertCron(request)
    if (denied) return denied

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    console.log('[FINALIZE-TOURNAMENTS] Start')

    // Récupérer tous les tournois actifs avec une ending_date passée
    const { data: tournamentsToCheck, error: fetchError } = await supabase
      .from('tournaments')
      .select('id, name, slug, status, ending_date, ending_matchday, competition_id, custom_competition_id')
      .eq('status', 'active')
      .not('ending_date', 'is', null)
      .lte('ending_date', now)

    if (fetchError) {
      console.error('[FINALIZE-TOURNAMENTS] Error fetching tournaments:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch tournaments', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!tournamentsToCheck || tournamentsToCheck.length === 0) {
      console.log('[FINALIZE-TOURNAMENTS] No tournaments')
      return NextResponse.json({
        success: true,
        message: 'No tournaments to finalize',
        processed: 0,
        finalized: 0,
        recalculated: 0
      })
    }

    console.log(`[FINALIZE-TOURNAMENTS] ${tournamentsToCheck.length} to check`)

    const results = {
      processed: 0,
      finalized: 0,
      recalculated: 0,
      errors: [] as string[]
    }

    // Traiter chaque tournoi
    for (const tournament of tournamentsToCheck) {
      results.processed++

      try {
        // Check tournament

        // Vérifier si tous les matchs du tournoi sont terminés
        const allMatchesFinished = await checkAllMatchesFinished(
          supabase,
          tournament.competition_id,
          tournament.custom_competition_id,
          tournament.ending_matchday
        )

        if (allMatchesFinished) {
          // Tous les matchs sont terminés : finaliser le tournoi
          console.log(`[FINALIZE-TOURNAMENTS] Finalizing tournament: ${tournament.name}`)

          const { error: updateError } = await supabase
            .from('tournaments')
            .update({
              status: 'completed',
            })
            .eq('id', tournament.id)

          if (updateError) {
            console.error(`[FINALIZE-TOURNAMENTS] Error finalizing tournament ${tournament.id}:`, updateError)
            results.errors.push(`${tournament.name}: ${updateError.message}`)
          } else {
            results.finalized++
            // Tournament finalized
            // Les notifications push + email de fin sont envoyées par le cron send-tournament-end-notifications (8h matin)
          }
        } else {
          // Certains matchs ne sont pas terminés : recalculer la ending_date
          // Matches not finished, recalculating ending_date

          try {
            const durationResult = await recalculateTournamentEndingDate(tournament.id, {
              reason: 'Recalcul automatique - matchs non terminés à la date prévue',
              previous_ending_matchday: tournament.ending_matchday,
              previous_ending_date: tournament.ending_date
            }, supabase)

            results.recalculated++
          } catch (recalcError: any) {
            console.error(`[FINALIZE-TOURNAMENTS] Error recalculating ending_date for ${tournament.id}:`, recalcError)
            results.errors.push(`${tournament.name}: ${recalcError.message}`)
          }
        }
      } catch (error: any) {
        console.error(`[FINALIZE-TOURNAMENTS] Error processing tournament ${tournament.id}:`, error)
        results.errors.push(`${tournament.name}: ${error.message}`)
      }
    }

    console.log(`[FINALIZE-TOURNAMENTS] Done: ${results.finalized} finalized, ${results.recalculated} recalculated, ${results.errors.length} errors`)

    return NextResponse.json({
      success: true,
      message: 'Tournament finalization completed',
      ...results,
      timestamp: now
    })

  } catch (error: any) {
    console.error('[FINALIZE-TOURNAMENTS] Fatal error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Vérifie si tous les matchs d'un tournoi sont terminés
 */
async function checkAllMatchesFinished(
  supabase: any,
  competitionId: number | null,
  customCompetitionId: string | null,
  endingMatchday: number
): Promise<boolean> {
  if (customCompetitionId) {
    // Compétition custom — vérifier via imported_matches (le statut réel est là, pas sur custom_competition_matches)
    const { data: matchdays } = await supabase
      .from('custom_competition_matchdays')
      .select('id')
      .eq('custom_competition_id', customCompetitionId)
      .eq('status', 'published')
      .lte('matchday_number', endingMatchday)

    if (!matchdays || matchdays.length === 0) {
      return false // Pas de matchdays publiés = tournoi pas encore prêt, ne pas finaliser
    }

    const matchdayIds = matchdays.map((md: any) => md.id)

    // Récupérer les imported_match_id des matchs custom
    const { data: customMatches } = await supabase
      .from('custom_competition_matches')
      .select('imported_match_id')
      .in('custom_matchday_id', matchdayIds)

    if (!customMatches || customMatches.length === 0) {
      return false // Pas de matchs = pas terminé
    }

    const importedMatchIds = customMatches
      .map((m: any) => m.imported_match_id)
      .filter((id: any) => id !== null)

    if (importedMatchIds.length === 0) {
      return false
    }

    // Vérifier le statut réel des matchs importés
    const { data: unfinishedMatches } = await supabase
      .from('imported_matches')
      .select('id')
      .in('id', importedMatchIds)
      .not('status', 'in', '("FINISHED","AWARDED")')
      .limit(1)

    return !unfinishedMatches || unfinishedMatches.length === 0

  } else if (competitionId) {
    // Compétition importée
    const { data: unfinishedMatches } = await supabase
      .from('imported_matches')
      .select('id')
      .eq('competition_id', competitionId)
      .lte('matchday', endingMatchday)
      .not('status', 'in', '("FINISHED","AWARDED")')
      .limit(1)

    return !unfinishedMatches || unfinishedMatches.length === 0

  } else {
    // Pas de compétition associée
    return true
  }
}
