'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import { getAdminUrl } from '@/lib/admin-path'

interface FormData {
  title: string
  email_subject: string
  email_body_html: string
  email_preview_text: string
  notification_title: string
  notification_body: string
  notification_image_url: string
  notification_click_url: string
}

export default function NewCommunicationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    email_subject: '',
    email_body_html: '',
    email_preview_text: '',
    notification_title: '',
    notification_body: '',
    notification_image_url: '',
    notification_click_url: '/dashboard'
  })

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }

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
      setLoading(false)
    }

    loadData()
  }, [router])

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      alert('Le titre est obligatoire')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('admin_communications')
      .insert({
        title: formData.title,
        status: 'draft',
        email_subject: formData.email_subject || null,
        email_body_html: formData.email_body_html || null,
        email_preview_text: formData.email_preview_text || null,
        notification_title: formData.notification_title || null,
        notification_body: formData.notification_body || null,
        notification_image_url: formData.notification_image_url || null,
        notification_click_url: formData.notification_click_url || '/dashboard',
        targeting_filters: {},
        created_by: profile.id
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      console.error('Error saving draft:', error)
      alert('Erreur lors de la sauvegarde')
      return
    }

    router.push(`${getAdminUrl()}/communications`)
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
              <h1 className="text-3xl font-bold text-gray-900">Nouvelle communication</h1>
              <p className="text-gray-600 mt-2">
                Créez une communication ponctuelle (email et/ou notification push)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`${getAdminUrl()}/communications`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Colonne gauche: Formulaire */}
          <div className="space-y-6">
            {/* Informations générales */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Informations générales</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre (pour identification interne) *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Annonce nouvelle fonctionnalité"
                  />
                </div>
              </div>
            </div>

            {/* Contenu Email */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu Email</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sujet de l'email
                  </label>
                  <input
                    type="text"
                    value={formData.email_subject}
                    onChange={(e) => handleChange('email_subject', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Découvrez notre nouvelle fonctionnalité !"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texte de prévisualisation
                  </label>
                  <input
                    type="text"
                    value={formData.email_preview_text}
                    onChange={(e) => handleChange('email_preview_text', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Ce texte apparaît dans la prévisualisation de l'email"
                    maxLength={255}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Apparaît après le sujet dans la boîte mail
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corps de l'email (HTML)
                  </label>
                  <textarea
                    value={formData.email_body_html}
                    onChange={(e) => handleChange('email_body_html', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                    rows={10}
                    placeholder="<html>...</html>"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Code HTML de l'email (Phase 2 : éditeur WYSIWYG)
                  </p>
                </div>
              </div>
            </div>

            {/* Contenu Notification Push */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu Notification Push</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre de la notification
                  </label>
                  <input
                    type="text"
                    value={formData.notification_title}
                    onChange={(e) => handleChange('notification_title', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Ex: Nouvelle fonctionnalité disponible"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum 100 caractères
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corps de la notification
                  </label>
                  <textarea
                    value={formData.notification_body}
                    onChange={(e) => handleChange('notification_body', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                    placeholder="Ex: Découvrez dès maintenant les nouvelles fonctionnalités de PronoHub !"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum 200 caractères
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL de l'image (optionnelle)
                  </label>
                  <input
                    type="text"
                    value={formData.notification_image_url}
                    onChange={(e) => handleChange('notification_image_url', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Image affichée dans la notification (Android)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lien de destination
                  </label>
                  <input
                    type="text"
                    value={formData.notification_click_url}
                    onChange={(e) => handleChange('notification_click_url', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="/dashboard"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL vers laquelle rediriger au clic sur la notification
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite: Preview */}
          <div className="space-y-6">
            {/* Preview Email */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Email</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {formData.email_subject ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Sujet:</p>
                      <p className="font-semibold text-gray-900">{formData.email_subject}</p>
                    </div>
                    {formData.email_preview_text && (
                      <div>
                        <p className="text-xs text-gray-500">Prévisualisation:</p>
                        <p className="text-sm text-gray-600">{formData.email_preview_text}</p>
                      </div>
                    )}
                    {formData.email_body_html && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <p className="text-xs text-gray-500 mb-2">Corps:</p>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: formData.email_body_html }}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">
                    L'aperçu de l'email s'affichera ici
                  </p>
                )}
              </div>
            </div>

            {/* Preview Notification */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Notification Push</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {formData.notification_title ? (
                  <div className="bg-white rounded-lg shadow-md p-4 max-w-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <img src="/images/logo.svg" alt="PronoHub" className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-1">PronoHub</p>
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {formData.notification_title}
                        </p>
                        {formData.notification_body && (
                          <p className="text-sm text-gray-600">
                            {formData.notification_body}
                          </p>
                        )}
                        {formData.notification_image_url && (
                          <div className="mt-2">
                            <img
                              src={formData.notification_image_url}
                              alt="Preview"
                              className="w-full rounded object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">
                    L'aperçu de la notification s'affichera ici
                  </p>
                )}
              </div>
            </div>

            {/* Informations ciblage (Phase 2) */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ciblage</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Phase 1 MVP:</strong> Envoi à tous les utilisateurs avec email.
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  Phase 2 : Filtres de ciblage avancés (tournoi actif, inactivité, FCM token, etc.)
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
