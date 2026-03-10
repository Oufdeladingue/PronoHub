import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

/**
 * POST /api/admin/users/bulk-delete
 * Supprime plusieurs utilisateurs en masse.
 * Ignore silencieusement les users protégés (créateurs de tournois, achats, etc.)
 * Retourne un résumé : supprimés / ignorés / erreurs.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Auth + admin check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { userIds } = await request.json()
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Liste d\'utilisateurs vide' }, { status: 400 })
    }

    // Max 100 users par requête
    if (userIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 utilisateurs par suppression groupée' }, { status: 400 })
    }

    // Exclure l'admin lui-même
    const filteredIds = userIds.filter((id: string) => id !== user.id)

    // Récupérer les users protégés en parallèle
    const [creatorResult, purchasesResult, subscriptionsResult, customCompResult] = await Promise.all([
      adminClient.from('tournaments').select('creator_id').in('creator_id', filteredIds),
      adminClient.from('tournament_purchases').select('user_id').in('user_id', filteredIds).eq('status', 'completed'),
      adminClient.from('user_subscriptions').select('user_id').in('user_id', filteredIds),
      adminClient.from('custom_competitions').select('created_by').in('created_by', filteredIds),
    ])

    // Collecter les IDs protégés
    const protectedIds = new Set<string>()
    creatorResult.data?.forEach(r => protectedIds.add(r.creator_id))
    purchasesResult.data?.forEach(r => protectedIds.add(r.user_id))
    subscriptionsResult.data?.forEach(r => protectedIds.add(r.user_id))
    customCompResult.data?.forEach(r => protectedIds.add(r.created_by))

    const deletableIds = filteredIds.filter((id: string) => !protectedIds.has(id))
    const skippedCount = filteredIds.length - deletableIds.length

    // Supprimer en séquence (Supabase admin API ne supporte pas le bulk delete)
    let deletedCount = 0
    let errorCount = 0

    for (const userId of deletableIds) {
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) {
        console.error(`[Admin] Bulk delete error for ${userId}:`, error.message)
        errorCount++
      } else {
        deletedCount++
      }
    }

    console.log(`[Admin] Bulk delete by ${user.id}: ${deletedCount} deleted, ${skippedCount} skipped, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `${deletedCount} supprimé(s), ${skippedCount} protégé(s)${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`
    })

  } catch (error) {
    console.error('[Admin] Bulk delete error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
