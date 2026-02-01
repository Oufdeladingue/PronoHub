'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { getAdminUrl } from '@/lib/admin-path'

interface AdminStats {
  totalUsers: number
  totalTournaments: number
  totalPredictions: number
  newUsersThisWeek: number
  newTournamentsThisWeek: number
  activeTournaments: number
}

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalTournaments: 0,
    totalPredictions: 0,
    newUsersThisWeek: 0,
    newTournamentsThisWeek: 0,
    activeTournaments: 0
  })

  useEffect(() => {
    async function loadAdminData() {
      const supabase = createClient()

      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

      // Récupérer le profil
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!isSuperAdmin(userProfile?.role as UserRole)) {
        router.push('/dashboard')
        return
      }

      setProfile(userProfile)

      // Calculer la date il y a 7 jours
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Récupérer toutes les stats en parallèle
      const [
        { count: totalUsers },
        { count: totalTournaments },
        { count: totalPredictions },
        { count: newUsersThisWeek },
        { count: newTournamentsThisWeek },
        { count: activeTournaments }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('role', 'super_admin'),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }),
        supabase.from('predictions').select('*', { count: 'exact', head: true }).eq('is_default_prediction', false),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()).neq('role', 'super_admin'),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo.toISOString()),
        supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('status', 'active')
      ])

      setStats({
        totalUsers: totalUsers || 0,
        totalTournaments: totalTournaments || 0,
        totalPredictions: totalPredictions || 0,
        newUsersThisWeek: newUsersThisWeek || 0,
        newTournamentsThisWeek: newTournamentsThisWeek || 0,
        activeTournaments: activeTournaments || 0
      })

      setLoading(false)
    }

    loadAdminData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        username={profile?.username || 'Admin'}
        userAvatar={profile?.avatar || 'avatar1'}
        context="admin"
        adminContext={{ currentPage: 'general' }}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Panneau d'administration</h1>
          <Link
            href="/dashboard?as=user"
            className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 border-2 border-purple-600 rounded-lg hover:bg-purple-50 transition-colors whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="hidden sm:inline">Dashboard Utilisateur</span>
            <span className="sm:hidden">Dashboard User</span>
          </Link>
        </div>

        {/* Statistiques principales */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Utilisateurs</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-2">{stats.totalUsers}</p>
            <p className="text-sm text-gray-500">
              {stats.newUsersThisWeek ? `+${stats.newUsersThisWeek} cette semaine` : 'Aucun nouvel utilisateur'}
            </p>
          </div>

          <Link href={getAdminUrl('usage')}>
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase">Tournois</h3>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 3a1 1 0 011-1h.01a1 1 0 010 2H7a1 1 0 01-1-1zm2 3a1 1 0 00-2 0v1a2 2 0 00-2 2v1a2 2 0 00-2 2v.683a3.7 3.7 0 011.055.485 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0c.355.211.69.386 1.055.485V12a2 2 0 00-2-2V9a2 2 0 00-2-2V6a1 1 0 10-2 0v1h-1V6a1 1 0 10-2 0v1H8V6zm10 8.868a3.704 3.704 0 01-4.055-.036 1.704 1.704 0 00-1.89 0 3.704 3.704 0 01-4.11 0 1.704 1.704 0 00-1.89 0A3.704 3.704 0 012 14.868V17a1 1 0 001 1h14a1 1 0 001-1v-2.132zM9 3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm3 0a1 1 0 011-1h.01a1 1 0 110 2H13a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-3xl font-bold text-green-600 mb-2">{stats.totalTournaments}</p>
              <p className="text-sm text-gray-500">
                {stats.activeTournaments ? `${stats.activeTournaments} actif${stats.activeTournaments > 1 ? 's' : ''}` : 'Aucun actif'}
              </p>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Pronostics</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-purple-600 mb-2">{stats.totalPredictions}</p>
            <p className="text-sm text-gray-500">Total effectués</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase">Activité</h3>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-orange-600 mb-2">{stats.newTournamentsThisWeek}</p>
            <p className="text-sm text-gray-500">Nouveaux tournois (7j)</p>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link href={getAdminUrl('data')}>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg sm:text-xl font-bold">Importer des matchs</h3>
              </div>
              <p className="text-purple-100">Ajouter des compétitions et synchroniser les matchs</p>
            </div>
          </Link>

          <Link href={getAdminUrl('usage')}>
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 3a1 1 0 011-1h.01a1 1 0 010 2H7a1 1 0 01-1-1zm2 3a1 1 0 00-2 0v1a2 2 0 00-2 2v1a2 2 0 00-2 2v.683a3.7 3.7 0 011.055.485 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0 1.704 1.704 0 001.89 0 3.704 3.704 0 014.11 0c.355.211.69.386 1.055.485V12a2 2 0 00-2-2V9a2 2 0 00-2-2V6a1 1 0 10-2 0v1h-1V6a1 1 0 10-2 0v1H8V6zm10 8.868a3.704 3.704 0 01-4.055-.036 1.704 1.704 0 00-1.89 0 3.704 3.704 0 01-4.11 0 1.704 1.704 0 00-1.89 0A3.704 3.704 0 012 14.868V17a1 1 0 001 1h14a1 1 0 001-1v-2.132zM9 3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm3 0a1 1 0 011-1h.01a1 1 0 110 2H13a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg sm:text-xl font-bold">Gérer les tournois</h3>
              </div>
              <p className="text-green-100">Voir et administrer tous les tournois</p>
            </div>
          </Link>

          <Link href={getAdminUrl('settings')}>
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg sm:text-xl font-bold">Paramètres</h3>
              </div>
              <p className="text-blue-100">Configurer l'application</p>
            </div>
          </Link>
        </div>

        {/* Informations système */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Vue d'ensemble
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Statistiques générales</h3>
              <ul className="space-y-2">
                <li className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Total utilisateurs</span>
                  <span className="font-semibold text-blue-600">{stats.totalUsers}</span>
                </li>
                <li className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Total tournois</span>
                  <span className="font-semibold text-green-600">{stats.totalTournaments}</span>
                </li>
                <li className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Tournois actifs</span>
                  <span className="font-semibold text-orange-600">{stats.activeTournaments}</span>
                </li>
                <li className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Total pronostics</span>
                  <span className="font-semibold text-purple-600">{stats.totalPredictions}</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Activité récente (7 jours)</h3>
              <ul className="space-y-2">
                <li className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Nouveaux utilisateurs</span>
                  <span className="font-semibold text-blue-600">{stats.newUsersThisWeek}</span>
                </li>
                <li className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-700">Nouveaux tournois</span>
                  <span className="font-semibold text-green-600">{stats.newTournamentsThisWeek}</span>
                </li>
                <li className="flex justify-between items-center py-2">
                  <span className="text-gray-700">Taux de croissance</span>
                  <span className="font-semibold text-purple-600">
                    {stats.totalUsers && stats.newUsersThisWeek ? `+${Math.round((stats.newUsersThisWeek / stats.totalUsers) * 100)}%` : '0%'}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
