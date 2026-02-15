import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

/**
 * DELETE /api/admin/users/[userId]
 * Supprime un utilisateur après vérification des contraintes de sécurité.
 * Bloqué si l'utilisateur :
 * - Est créateur d'un tournoi
 * - A des records financiers (purchases, subscriptions)
 * - A créé des compétitions custom
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier l'authentification et les droits super admin
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

    // Empêcher la suppression de son propre compte
    if (userId === user.id) {
      return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 })
    }

    // Vérifier que l'utilisateur existe
    const { data: targetUser } = await adminClient
      .from('profiles')
      .select('id, username, email')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 })
    }

    // === Vérifications de sécurité en parallèle ===
    const [
      createdTournaments,
      purchases,
      subscriptions,
      customCompetitions
    ] = await Promise.all([
      // Tournois créés par cet utilisateur
      adminClient
        .from('tournaments')
        .select('id, name, status')
        .eq('creator_id', userId),

      // Achats/transactions
      adminClient
        .from('tournament_purchases')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed'),

      // Abonnements
      adminClient
        .from('user_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),

      // Compétitions custom créées
      adminClient
        .from('custom_competitions')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', userId),
    ])

    // Construire la liste des blocages
    const blockers: string[] = []

    if (createdTournaments.data && createdTournaments.data.length > 0) {
      const names = createdTournaments.data.map(t => t.name).join(', ')
      blockers.push(`Créateur de ${createdTournaments.data.length} tournoi(s) : ${names}`)
    }

    if (purchases.count && purchases.count > 0) {
      blockers.push(`${purchases.count} achat(s) enregistré(s)`)
    }

    if (subscriptions.count && subscriptions.count > 0) {
      blockers.push(`Abonnement(s) actif(s) ou passé(s)`)
    }

    if (customCompetitions.count && customCompetitions.count > 0) {
      blockers.push(`Créateur de ${customCompetitions.count} compétition(s) custom`)
    }

    if (blockers.length > 0) {
      return NextResponse.json({
        error: 'Suppression impossible',
        blockers,
        username: targetUser.username
      }, { status: 409 })
    }

    // === Suppression sécurisée ===
    // Supprimer depuis auth.users → CASCADE supprime profiles et toutes les dépendances
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('[Admin] Error deleting user:', deleteError)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }

    console.log(`[Admin] User deleted: ${targetUser.username} (${targetUser.email}) by ${user.id}`)

    return NextResponse.json({
      success: true,
      message: `Utilisateur "${targetUser.username}" supprimé avec succès`
    })

  } catch (error: any) {
    console.error('[Admin] Delete user error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
