import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import Link from 'next/link'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!isSuperAdmin(profile?.role as UserRole)) {
    redirect('/dashboard')
  }

  // Récupérer le nombre total d'utilisateurs (excluant les super admins)
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .neq('role', 'super_admin')

  // Récupérer le nombre total de tournois créés
  const { count: totalTournaments } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation
        username={profile?.username || 'Admin'}
        userAvatar={profile?.avatar || 'avatar1'}
        context="admin"
        adminContext={{ currentPage: 'general' }}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Général</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Statistiques */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Utilisateurs</h3>
            <p className="text-3xl font-bold text-blue-600">{totalUsers || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Total inscrits</p>
          </div>

          <Link href="/admin/tournaments">
            <div className="bg-white p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Tournois</h3>
              <p className="text-3xl font-bold text-green-600">{totalTournaments || 0}</p>
              <p className="text-sm text-gray-500 mt-1">Total créés</p>
            </div>
          </Link>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Pronostics</h3>
            <p className="text-3xl font-bold text-purple-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Total effectués</p>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Vue d'ensemble</h2>
          <p className="text-gray-600">
            Bienvenue dans le panneau d'administration SuperAdmin.
          </p>
        </div>
      </main>
    </div>
  )
}
