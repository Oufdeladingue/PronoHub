'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import { getAdminUrl } from '@/lib/admin-path'
import { EMAIL_TEMPLATES, type TargetingFilters } from '@/lib/admin/email-templates'
import ImageUploader from '@/components/admin/ImageUploader'
import TargetingSelector from '@/components/admin/TargetingSelector'
import EmailEditor from '@/components/admin/EmailEditor'
import EmojiPicker from '@/components/admin/EmojiPicker'

interface FormData {
  title: string
  email_subject: string
  email_body_html: string
  email_preview_text: string
  email_cta_text: string
  email_cta_url: string
  notification_title: string
  notification_body: string
  notification_image_url: string
  notification_click_url: string
  targeting_filters: TargetingFilters
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
    email_cta_text: 'Découvrir',
    email_cta_url: 'https://www.pronohub.club/dashboard',
    notification_title: '',
    notification_body: '',
    notification_image_url: '',
    notification_click_url: '/dashboard',
    targeting_filters: {}
  })
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [recipientCount, setRecipientCount] = useState<{
    total: number
    emailRecipients: number
    pushRecipients: number
  } | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [activeEmojiField, setActiveEmojiField] = useState<string | null>(null)

  // Charger le nombre de destinataires quand les filtres changent
  useEffect(() => {
    const fetchRecipientCount = async () => {
      console.log('[Communications] Fetching recipient count with filters:', formData.targeting_filters)
      setLoadingCount(true)
      try {
        const response = await fetch('/api/admin/communications/count-recipients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targeting_filters: formData.targeting_filters })
        })
        const data = await response.json()
        console.log('[Communications] Recipient count response:', data)
        if (data.success) {
          setRecipientCount({
            total: data.total,
            emailRecipients: data.emailRecipients,
            pushRecipients: data.pushRecipients
          })
        }
      } catch (error) {
        console.error('Error fetching recipient count:', error)
      } finally {
        setLoadingCount(false)
      }
    }

    // Debounce pour éviter trop de requêtes
    const timeoutId = setTimeout(fetchRecipientCount, 500)
    return () => clearTimeout(timeoutId)
  }, [formData.targeting_filters])

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

  const handleChange = (field: keyof FormData, value: string | TargetingFilters) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const applyTemplate = (templateId: string) => {
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        email_subject: template.subject,
        email_body_html: template.html,
        email_preview_text: template.previewText
      }))
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    if (activeEmojiField) {
      setFormData(prev => ({
        ...prev,
        [activeEmojiField]: (prev[activeEmojiField as keyof FormData] as string) + emoji
      }))
    }
    setActiveEmojiField(null)
  }

  // Remplacer les variables pour la preview
  const previewText = (text: string) => {
    return text
      .replace(/\[username\]/gi, profile?.username || 'JohnDoe')
      .replace(/\[email\]/gi, profile?.email || 'john@example.com')
      .replace(/\[CTA_TEXT\]/gi, formData.email_cta_text || 'Découvrir')
      .replace(/\[CTA_URL\]/gi, formData.email_cta_url || 'https://www.pronohub.club/dashboard')
  }

  const handleSaveDraft = async () => {
    if (!formData.title.trim()) {
      alert('Le titre est obligatoire')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()

      // Vérifier l'utilisateur
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Session expirée, veuillez vous reconnecter')
        setSaving(false)
        router.push('/auth/login')
        return
      }

      console.log('[Draft] Saving draft...')
      const { data, error } = await supabase
        .from('admin_communications')
        .insert({
          title: formData.title,
          status: 'draft',
          email_subject: formData.email_subject || null,
          email_body_html: formData.email_body_html || null,
          email_preview_text: formData.email_preview_text || null,
          email_cta_text: formData.email_cta_text || null,
          email_cta_url: formData.email_cta_url || null,
          notification_title: formData.notification_title || null,
          notification_body: formData.notification_body || null,
          notification_image_url: formData.notification_image_url || null,
          notification_click_url: formData.notification_click_url || '/dashboard',
          targeting_filters: formData.targeting_filters,
          created_by: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('[Draft] Error saving draft:', error)
        alert(`Erreur lors de la sauvegarde: ${error.message}`)
        setSaving(false)
        return
      }

      console.log('[Draft] Draft saved successfully:', data)
      console.log('[Draft] Navigating to:', `${getAdminUrl()}/communications`)

      // Ensure state is reset before navigation
      setSaving(false)

      // Use window.location for reliable navigation
      window.location.href = `${getAdminUrl()}/communications`
    } catch (err: any) {
      console.error('[Draft] Unexpected error:', err)
      alert(`Erreur inattendue: ${err.message}`)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header avec actions */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Nouvelle communication</h1>
            <p className="text-sm text-gray-600 mt-1">
              Créez et envoyez des emails et notifications push aux utilisateurs
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer le brouillon'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Informations générales - Pleine largeur */}
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                  placeholder="Ex: Annonce nouvelle fonctionnalité"
                />
              </div>
            </div>
          </div>

          {/* Ciblage - Pleine largeur */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ciblage des destinataires</h2>

            <TargetingSelector
              value={formData.targeting_filters}
              onChange={(filters) => handleChange('targeting_filters', filters)}
            />

            {/* Compteur de destinataires */}
            <div className="mt-4">
              {loadingCount ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                    Calcul du nombre de destinataires...
                  </div>
                </div>
              ) : recipientCount && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-green-900">
                      📊 {recipientCount.total} destinataire{recipientCount.total > 1 ? 's' : ''} trouvé{recipientCount.total > 1 ? 's' : ''}
                    </p>
                    {recipientCount.total > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/admin/communications/export-recipients', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ targeting_filters: formData.targeting_filters, format: 'csv' })
                            })
                            const blob = await response.blob()
                            const url = window.URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `destinataires-${Date.now()}.csv`
                            document.body.appendChild(a)
                            a.click()
                            window.URL.revokeObjectURL(url)
                            document.body.removeChild(a)
                          } catch (error) {
                            console.error('Error exporting:', error)
                            alert('Erreur lors de l\'export')
                          }
                        }}
                        className="text-xs bg-white hover:bg-gray-50 text-green-700 px-3 py-1 rounded border border-green-300 transition-colors"
                      >
                        📥 Export CSV
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
                    <div className="flex items-center gap-2">
                      <span>📧 Email:</span>
                      <span className="font-semibold">{recipientCount.emailRecipients}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>📱 Push:</span>
                      <span className="font-semibold">{recipientCount.pushRecipients}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Template Email + Contenu Email + Aperçu - Grid 2 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche: Contenu Email */}
            <div className="space-y-6">
              {/* Template Email */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Template Email</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Partir d'un template
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => {
                        setSelectedTemplate(e.target.value)
                        applyTemplate(e.target.value)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                    >
                      <option value="">-- Choisir un template --</option>
                      {EMAIL_TEMPLATES.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Contenu Email */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu Email</h2>

                <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Sujet de l'email
                    </label>
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  <input
                    type="text"
                    value={formData.email_subject}
                    onChange={(e) => handleChange('email_subject', e.target.value)}
                    onFocus={() => setActiveEmojiField('email_subject')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="Ex: 🎉 Découvrez notre nouvelle fonctionnalité !"
                    maxLength={255}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Variables: <code className="bg-gray-100 px-1 py-0.5 rounded">[username]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[email]</code>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Texte de prévisualisation
                  </label>
                  <input
                    type="text"
                    value={formData.email_preview_text}
                    onChange={(e) => handleChange('email_preview_text', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="Ex: Ce texte apparaît dans la prévisualisation de l'email"
                    maxLength={255}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Texte affiché dans les clients email avant l'ouverture
                  </p>
                </div>

                <EmailEditor
                  value={formData.email_body_html}
                  onChange={(value) => handleChange('email_body_html', value)}
                />

                {/* Champs CTA */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Bouton d'action (CTA)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Texte du bouton
                      </label>
                      <input
                        type="text"
                        value={formData.email_cta_text}
                        onChange={(e) => handleChange('email_cta_text', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                        placeholder="Ex: Découvrir"
                        maxLength={50}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lien du bouton
                      </label>
                      <input
                        type="url"
                        value={formData.email_cta_url}
                        onChange={(e) => handleChange('email_cta_url', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>

            {/* Colonne droite: Aperçu Email */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Email</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {formData.email_subject ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Sujet:</p>
                      <p className="font-semibold text-gray-900">{previewText(formData.email_subject)}</p>
                    </div>
                    {formData.email_preview_text && (
                      <div>
                        <p className="text-xs text-gray-500">Prévisualisation:</p>
                        <p className="text-sm text-gray-600">{previewText(formData.email_preview_text)}</p>
                      </div>
                    )}
                    {formData.email_body_html && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <p className="text-xs text-gray-500 mb-2">Corps:</p>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: previewText(formData.email_body_html) }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 italic mt-2">
                      💡 Variables remplacées par des exemples
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">
                    L'aperçu de l'email s'affichera ici
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Contenu Notification + Aperçu - Grid 2 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche: Contenu Notification Push */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu Notification Push</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Titre de la notification
                    </label>
                    <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  </div>
                  <input
                    type="text"
                    value={formData.notification_title}
                    onChange={(e) => handleChange('notification_title', e.target.value)}
                    onFocus={() => setActiveEmojiField('notification_title')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="Ex: Nouvelle fonctionnalité disponible"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corps de la notification
                  </label>
                  <textarea
                    value={formData.notification_body}
                    onChange={(e) => handleChange('notification_body', e.target.value)}
                    onFocus={() => setActiveEmojiField('notification_body')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    rows={3}
                    placeholder="Ex: Découvrez dès maintenant les nouvelles fonctionnalités de PronoHub !"
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum 200 caractères | Variables: <code className="bg-gray-100 px-1 py-0.5 rounded">[username]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[email]</code>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image de notification (optionnelle)
                  </label>

                  <ImageUploader
                    onImageUploaded={(url) => handleChange('notification_image_url', url)}
                    currentImageUrl={formData.notification_image_url}
                  />

                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Ou entrez une URL
                    </label>
                    <input
                      type="text"
                      value={formData.notification_image_url}
                      onChange={(e) => handleChange('notification_image_url', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lien de destination
                  </label>
                  <input
                    type="text"
                    value={formData.notification_click_url}
                    onChange={(e) => handleChange('notification_click_url', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="/dashboard"
                  />
                </div>
              </div>
            </div>

            {/* Colonne droite: Aperçu Notification */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Notification</h2>

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
                          {previewText(formData.notification_title)}
                        </p>
                        {formData.notification_body && (
                          <p className="text-sm text-gray-600">
                            {previewText(formData.notification_body)}
                          </p>
                        )}
                        {formData.notification_image_url && (
                          <div className="mt-2">
                            <img
                              src={formData.notification_image_url}
                              alt="Preview"
                              className="w-full rounded object-cover"
                              style={{ maxHeight: '120px' }}
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
          </div>
        </div>
      </main>
    </div>
  )
}
