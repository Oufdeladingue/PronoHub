import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import AdminNav from '@/components/AdminNav'

export default async function AdminImportPage() {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Import</h1>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Import de données Football</h2>
          <p className="text-gray-600 mb-6">
            Importez les compétitions et matchs depuis l'API Football-Data.
          </p>

          <div className="space-y-4">
            <button className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Importer les compétitions
            </button>

            <button className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition ml-0 md:ml-4">
              Synchroniser les matchs
            </button>
          </div>

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note :</strong> La fonctionnalité d'import sera développée prochainement.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
