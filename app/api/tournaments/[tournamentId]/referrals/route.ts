import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const THRESHOLD = 2 // nb de filleuls pour débloquer les stats

/**
 * GET /api/tournaments/[tournamentId]/referrals
 * Progression de parrainage du user courant sur ce tournoi :
 *  - count    : nb de filleuls venus via son lien ?ref=
 *  - threshold: seuil pour débloquer (2)
 *  - unlocked : true si le seuil est atteint
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  try {
    const { tournamentId } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ count: 0, threshold: THRESHOLD, unlocked: false })
    }

    const { count } = await supabase
      .from('tournament_participants')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('referred_by', user.id)

    const c = count || 0
    return NextResponse.json({ count: c, threshold: THRESHOLD, unlocked: c >= THRESHOLD })
  } catch (error) {
    console.error('Error fetching referrals:', error)
    return NextResponse.json({ count: 0, threshold: THRESHOLD, unlocked: false })
  }
}
