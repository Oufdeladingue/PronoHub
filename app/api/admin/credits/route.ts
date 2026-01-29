import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Vérifier l'authentification et les droits admin
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

    // Paramètres de pagination et recherche
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const offset = (page - 1) * pageSize

    // Requête pour compter le total d'utilisateurs
    let countQuery = adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (search) {
      countQuery = countQuery.ilike('username', `%${search}%`)
    }

    const { count: totalCount } = await countQuery

    // Requête pour récupérer les utilisateurs avec pagination
    let usersQuery = adminClient
      .from('profiles')
      .select('id, username, avatar')
      .order('username', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (search) {
      usersQuery = usersQuery.ilike('username', `%${search}%`)
    }

    const { data: usersData, error: usersError } = await usersQuery

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Erreur lors de la récupération des utilisateurs' }, { status: 500 })
    }

    if (!usersData || usersData.length === 0) {
      return NextResponse.json({
        success: true,
        users: [],
        totalCount: 0,
        page,
        pageSize
      })
    }

    // Optimisation : récupérer toutes les données en parallèle avec des requêtes groupées
    const userIds = usersData.map(u => u.id)

    const [
      allParticipations,
      allSlotCredits,
      allPlatiniumSoloCredits,
      allPlatiniumGroupCredits,
      allDurationExtensionCredits
    ] = await Promise.all([
      // Récupérer toutes les participations en une seule requête
      adminClient
        .from('tournament_participants')
        .select(`
          user_id,
          tournament_id,
          participant_role,
          invite_type,
          has_paid,
          tournaments (
            tournament_type,
            creator_id
          )
        `)
        .in('user_id', userIds)
        .then(r => r.data || []),

      // Récupérer tous les slots disponibles
      adminClient
        .from('tournament_purchases')
        .select('user_id')
        .in('user_id', userIds)
        .eq('purchase_type', 'slot_invite')
        .eq('used', false)
        .then(r => r.data || []),

      // Récupérer tous les crédits platinium solo
      adminClient
        .from('tournament_purchases')
        .select('user_id')
        .in('user_id', userIds)
        .eq('purchase_type', 'tournament_creation')
        .eq('tournament_subtype', 'platinium_solo')
        .eq('status', 'completed')
        .eq('used', false)
        .then(r => r.data || []),

      // Récupérer tous les crédits platinium prepaid 11
      adminClient
        .from('tournament_purchases')
        .select('user_id')
        .in('user_id', userIds)
        .eq('purchase_type', 'tournament_creation')
        .eq('tournament_subtype', 'platinium_group')
        .eq('status', 'completed')
        .eq('used', false)
        .then(r => r.data || []),

      // Récupérer tous les crédits d'extension de durée
      adminClient
        .from('tournament_purchases')
        .select('user_id')
        .in('user_id', userIds)
        .eq('purchase_type', 'duration_extension')
        .eq('status', 'completed')
        .eq('used', false)
        .then(r => r.data || [])
    ])

    // Créer des maps pour regrouper par user_id
    const participationsMap = new Map<string, any[]>()
    allParticipations.forEach((p: any) => {
      if (!participationsMap.has(p.user_id)) {
        participationsMap.set(p.user_id, [])
      }
      participationsMap.get(p.user_id)!.push(p)
    })

    const countByUser = (data: any[]) => {
      const map = new Map<string, number>()
      data.forEach((item: any) => {
        map.set(item.user_id, (map.get(item.user_id) || 0) + 1)
      })
      return map
    }

    const slotsMap = countByUser(allSlotCredits)
    const platiniumSoloMap = countByUser(allPlatiniumSoloCredits)
    const platiniumGroupMap = countByUser(allPlatiniumGroupCredits)
    const durationExtensionMap = countByUser(allDurationExtensionCredits)

    // Construire les stats pour chaque utilisateur
    const userStats = usersData.map((user) => {
      const participations = participationsMap.get(user.id) || []

      const stats = {
        freeKick: { total: 0, paidSlot: 0 },
        oneShot: { total: 0, paid: 0 },
        elite: { total: 0, paid: 0 },
        platinium: { total: 0, paid: 0 },
        corpo: { total: 0, paid: 0 }
      }

      participations.forEach((p: any) => {
        const tournamentType = p.tournaments?.tournament_type
        const isCreator = p.tournaments?.creator_id === user.id
        const hasPaid = p.has_paid || p.invite_type === 'paid_slot'

        switch (tournamentType) {
          case 'free':
            stats.freeKick.total++
            if (p.invite_type === 'paid_slot') stats.freeKick.paidSlot++
            break
          case 'oneshot':
            stats.oneShot.total++
            if (hasPaid || isCreator) stats.oneShot.paid++
            break
          case 'elite':
            stats.elite.total++
            if (hasPaid || isCreator) stats.elite.paid++
            break
          case 'platinium':
            stats.platinium.total++
            if (hasPaid) stats.platinium.paid++
            break
          case 'enterprise':
            stats.corpo.total++
            if (hasPaid) stats.corpo.paid++
            break
        }
      })

      return {
        userId: user.id,
        username: user.username || 'Sans nom',
        avatar: user.avatar || 'avatar1',
        ...stats,
        availableSlots: slotsMap.get(user.id) || 0,
        platiniumCredits: platiniumSoloMap.get(user.id) || 0,
        platiniumPrepaid11Credits: platiniumGroupMap.get(user.id) || 0,
        durationExtensionCredits: durationExtensionMap.get(user.id) || 0
      }
    })

    return NextResponse.json({
      success: true,
      users: userStats,
      totalCount: totalCount || 0,
      page,
      pageSize
    })

  } catch (error) {
    console.error('Error in admin credits API:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
