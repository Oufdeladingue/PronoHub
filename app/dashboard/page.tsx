import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // Récupérer le profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isSuper = isSuperAdmin(profile?.role as UserRole)

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Menu Super Admin */}
      {isSuper && <AdminNav />}

      {/* Navigation principale */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">PronoHub</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Bonjour, {profile?.username || 'utilisateur'} !</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Créer un tournoi</h2>
            <p className="text-gray-600 mb-4">
              Lancez votre propre tournoi de pronostics et invitez vos amis à participer.
            </p>
            <a href="/vestiaire" className="block w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-center">
              Nouveau tournoi
            </a>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Rejoindre un tournoi</h2>
            <p className="text-gray-600 mb-4">
              Vous avez reçu un code d'invitation ? Rejoignez un tournoi existant.
            </p>
            <button className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition">
              Entrer un code
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Mes tournois</h2>
          <p className="text-gray-500 text-center py-8">
            Vous ne participez à aucun tournoi pour le moment.
          </p>
        </div>
      </main>
    </div>
  )
}
