'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { getAdminUrl } from '@/lib/admin-path'

interface Communication {
  id: string
  title: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  created_at: string
  updated_at: string
  scheduled_at: string | null
  sent_at: string | null
  stats_total_recipients: number
  stats_emails_sent: number
  stats_push_sent: number
}

export default function CommunicationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [communications, setCommunications] = useState<Communication[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
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

      // Charger les communications
      const { data: comms, error } = await supabase
        .from('admin_communications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading communications:', error)
      } else {
        setCommunications(comms || [])
      }

      setLoading(false)
    }

    loadData()
  }, [router])

  const handleDelete = async (commId: string, commTitle: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la communication "${commTitle}" ?\n\nCette action est irréversible.`)) {
      return
    }

    setDeleting(commId)
    try {
      const supabase = createClient()

      const { error } = await supabase
        .from('admin_communications')
        .delete()
        .eq('id', commId)

      if (error) {
        console.error('Error deleting communication:', error)
        alert(`Erreur lors de la suppression: ${error.message}`)
        return
      }

      // Retirer de la liste locale
      setCommunications(prev => prev.filter(c => c.id !== commId))
    } catch (err: any) {
      console.error('Unexpected error:', err)
      alert(`Erreur inattendue: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const getStatusBadge = (status: Communication['status']) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }

    const labels = {
      draft: 'Brouillon',
      scheduled: 'Planifié',
      sent: 'Envoyé',
      failed: 'Échec'
    }

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
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
        adminContext={{ currentPage: 'communications' }}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
              <p className="text-gray-600 mt-2">
                Gérez vos communications ponctuelles (emails et notifications push)
              </p>
            </div>
            <Link
              href={`${getAdminUrl()}/communications/new`}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Nouvelle communication
            </Link>
          </div>
        </div>

        {/* Liste des communications */}
        {communications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune communication
            </h3>
            <p className="text-gray-500 mb-6">
              Créez votre première communication pour envoyer des emails et notifications push à vos utilisateurs.
            </p>
            <Link
              href={`${getAdminUrl()}/communications/new`}
              className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Créer une communication
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Titre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Création
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Diffusion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destinataires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {communications.map((comm) => (
                  <tr key={comm.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{comm.title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(comm.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(comm.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {comm.sent_at ? formatDate(comm.sent_at) : comm.scheduled_at ? formatDate(comm.scheduled_at) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {comm.stats_total_recipients > 0 ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{comm.stats_total_recipients} total</span>
                            <div className="flex gap-3 text-xs text-gray-500">
                              <span>📧 {comm.stats_emails_sent}</span>
                              <span>📱 {comm.stats_push_sent}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-3">
                        <Link
                          href={`${getAdminUrl()}/communications/${comm.id}`}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          {comm.status === 'draft' ? 'Éditer' : 'Voir'}
                        </Link>
                        {comm.status === 'sent' && (
                          <Link
                            href={`${getAdminUrl()}/communications/${comm.id}/stats`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Statistiques
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(comm.id, comm.title)}
                          disabled={deleting === comm.id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === comm.id ? 'Suppression...' : 'Supprimer'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
