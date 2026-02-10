'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import { getAdminUrl } from '@/lib/admin-path'
import TargetingSelector from '@/components/admin/TargetingSelector'
import EmojiPicker from '@/components/admin/EmojiPicker'
import type { TargetingFilters } from '@/lib/admin/email-templates'

interface Communication {
  id: string
  title: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  email_subject: string | null
  email_body_html: string | null
  email_preview_text: string | null
  email_cta_text: string | null
  email_cta_url: string | null
  notification_title: string | null
  notification_body: string | null
  notification_image_url: string | null
  notification_click_url: string | null
  targeting_filters: TargetingFilters | null
  created_at: string
  updated_at: string
  scheduled_at: string | null
  sent_at: string | null
}

export default function EditCommunicationPage() {
  const router = useRouter()
  const params = useParams()
  const communicationId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [recipientCount, setRecipientCount] = useState({ total: 0, email: 0, push: 0 })
  const [countingRecipients, setCountingRecipients] = useState(false)
  const [activeEmojiField, setActiveEmojiField] = useState<string | null>(null)

  // Compter les destinataires quand les filtres changent
  useEffect(() => {
    if (!communication?.targeting_filters) return

    const filters = communication.targeting_filters

    async function fetchRecipientCount() {
      setCountingRecipients(true)
      try {
        const response = await fetch('/api/admin/communications/count-recipients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targeting_filters: filters })
        })

        const data = await response.json()
        if (data.success) {
          setRecipientCount({
            total: data.total,
            email: data.emailRecipients,
            push: data.pushRecipients
          })
        }
      } catch (error) {
        console.error('Error counting recipients:', error)
      } finally {
        setCountingRecipients(false)
      }
    }

    fetchRecipientCount()
  }, [communication?.targeting_filters])

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

      // Charger la communication
      const { data: comm, error } = await supabase
        .from('admin_communications')
        .select('*')
        .eq('id', communicationId)
        .single()

      if (error || !comm) {
        console.error('Error loading communication:', error)
        router.push(`${getAdminUrl()}/communications`)
        return
      }

      setCommunication(comm)
      setLoading(false)
    }

    loadData()
  }, [router, communicationId])

  const handleChange = (field: keyof Communication, value: string) => {
    if (!communication) return
    setCommunication(prev => prev ? { ...prev, [field]: value } : null)
  }

  const handleTargetingChange = (filters: TargetingFilters) => {
    if (!communication) return
    setCommunication(prev => prev ? { ...prev, targeting_filters: filters } : null)
  }

  const handleEmojiSelect = (emoji: string) => {
    if (!activeEmojiField || !communication) return

    const currentValue = communication[activeEmojiField as keyof Communication] as string || ''
    handleChange(activeEmojiField as keyof Communication, currentValue + emoji)
    setActiveEmojiField(null)
  }

  const previewText = (text: string) => {
    return text
      .replace(/\[username\]/gi, profile?.username || 'JohnDoe')
      .replace(/\[email\]/gi, profile?.email || 'john@example.com')
      .replace(/\[CTA_TEXT\]/gi, communication?.email_cta_text || 'Découvrir')
      .replace(/\[CTA_URL\]/gi, communication?.email_cta_url || 'https://www.pronohub.club/dashboard')
  }

  const handleSave = async () => {
    if (!communication || !communication.title.trim()) {
      alert('Le titre est obligatoire')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('admin_communications')
      .update({
        title: communication.title,
        email_subject: communication.email_subject || null,
        email_body_html: communication.email_body_html || null,
        email_preview_text: communication.email_preview_text || null,
        email_cta_text: communication.email_cta_text || null,
        email_cta_url: communication.email_cta_url || null,
        notification_title: communication.notification_title || null,
        notification_body: communication.notification_body || null,
        notification_image_url: communication.notification_image_url || null,
        notification_click_url: communication.notification_click_url || '/dashboard',
        targeting_filters: communication.targeting_filters || null
      })
      .eq('id', communicationId)

    setSaving(false)

    if (error) {
      console.error('Error saving:', error)
      alert('Erreur lors de la sauvegarde')
      return
    }

    alert('Communication sauvegardée !')
  }

  const handleSendNow = async () => {
    if (!communication) return

    if (!communication.email_subject && !communication.notification_title) {
      alert('Vous devez remplir au moins un contenu (email ou notification)')
      return
    }

    const confirmed = confirm(
      'Êtes-vous sûr de vouloir envoyer cette communication immédiatement à tous les utilisateurs ?'
    )

    if (!confirmed) return

    setSending(true)

    try {
      const response = await fetch('/api/admin/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ communicationId })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }

      alert(`Communication envoyée avec succès ! ${data.totalSent} destinataires`)
      router.push(`${getAdminUrl()}/communications`)
    } catch (error: any) {
      console.error('Error sending:', error)
      alert(`Erreur lors de l'envoi: ${error.message}`)
    } finally {
      setSending(false)
    }
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

  if (!communication) return null

  const canEdit = communication.status === 'draft'

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
              <h1 className="text-3xl font-bold text-gray-900">
                {canEdit ? 'Éditer' : 'Voir'} la communication
              </h1>
              <p className="text-gray-600 mt-2">
                {communication.status === 'sent' ? 'Communication envoyée' : 'Brouillon'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push(`${getAdminUrl()}/communications`)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Retour
              </button>
              {canEdit && (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={handleSendNow}
                    disabled={sending}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                        Envoyer maintenant
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
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
                  value={communication.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  disabled={!canEdit}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                  placeholder="Ex: Annonce nouvelle fonctionnalité"
                />
              </div>
            </div>
          </div>

          {/* Ciblage - Pleine largeur */}
          {canEdit && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Ciblage des destinataires</h2>

              <TargetingSelector
                value={communication.targeting_filters || {}}
                onChange={handleTargetingChange}
              />

              {/* Compteur de destinataires */}
              <div className="mt-4">
                {countingRecipients ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                      Calcul du nombre de destinataires...
                    </div>
                  </div>
                ) : recipientCount && recipientCount.total > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-green-900">
                        📊 {recipientCount.total} destinataire{recipientCount.total > 1 ? 's' : ''} trouvé{recipientCount.total > 1 ? 's' : ''}
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/admin/communications/export-recipients', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ targeting_filters: communication.targeting_filters, format: 'csv' })
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
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-green-700">
                      <div className="flex items-center gap-2">
                        <span>📧 Email:</span>
                        <span className="font-semibold">{recipientCount.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📱 Push:</span>
                        <span className="font-semibold">{recipientCount.push}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Email + Aperçu - Grid 2 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche: Contenu Email */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contenu Email</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Sujet de l'email
                    </label>
                    {canEdit && <EmojiPicker onEmojiSelect={handleEmojiSelect} />}
                  </div>
                  <input
                    type="text"
                    value={communication.email_subject || ''}
                    onChange={(e) => handleChange('email_subject', e.target.value)}
                    onFocus={() => setActiveEmojiField('email_subject')}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
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
                    value={communication.email_preview_text || ''}
                    onChange={(e) => handleChange('email_preview_text', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                    placeholder="Ex: Ce texte apparaît dans la prévisualisation de l'email"
                    maxLength={255}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corps de l'email (HTML)
                  </label>
                  <textarea
                    value={communication.email_body_html || ''}
                    onChange={(e) => handleChange('email_body_html', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white disabled:bg-gray-100"
                    rows={10}
                    placeholder="<html>...</html>"
                  />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Bouton d'action (CTA)</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Texte du bouton</label>
                      <input
                        type="text"
                        value={communication.email_cta_text || ''}
                        onChange={(e) => handleChange('email_cta_text', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        placeholder="Ex: Découvrir"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Lien du bouton</label>
                      <input
                        type="text"
                        value={communication.email_cta_url || ''}
                        onChange={(e) => handleChange('email_cta_url', e.target.value)}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:bg-gray-100"
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne droite: Aperçu Email */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Email</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {communication.email_subject ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Sujet:</p>
                      <p className="font-semibold text-gray-900">{previewText(communication.email_subject)}</p>
                    </div>
                    {communication.email_preview_text && (
                      <div>
                        <p className="text-xs text-gray-500">Prévisualisation:</p>
                        <p className="text-sm text-gray-600">{previewText(communication.email_preview_text)}</p>
                      </div>
                    )}
                    {communication.email_body_html && (
                      <div className="mt-4 border-t border-gray-200 pt-4">
                        <p className="text-xs text-gray-500 mb-2">Corps:</p>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: previewText(communication.email_body_html) }}
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

          {/* Notification + Aperçu - Grid 2 colonnes */}
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
                    {canEdit && <EmojiPicker onEmojiSelect={handleEmojiSelect} />}
                  </div>
                  <input
                    type="text"
                    value={communication.notification_title || ''}
                    onChange={(e) => handleChange('notification_title', e.target.value)}
                    onFocus={() => setActiveEmojiField('notification_title')}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                    placeholder="Ex: Nouvelle fonctionnalité disponible"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corps de la notification
                  </label>
                  <textarea
                    value={communication.notification_body || ''}
                    onChange={(e) => handleChange('notification_body', e.target.value)}
                    onFocus={() => setActiveEmojiField('notification_body')}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                    rows={3}
                    placeholder="Ex: Découvrez dès maintenant les nouvelles fonctionnalités de PronoHub !"
                    maxLength={200}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL de l'image (optionnelle)
                  </label>
                  <input
                    type="text"
                    value={communication.notification_image_url || ''}
                    onChange={(e) => handleChange('notification_image_url', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lien de destination
                  </label>
                  <input
                    type="text"
                    value={communication.notification_click_url || ''}
                    onChange={(e) => handleChange('notification_click_url', e.target.value)}
                    disabled={!canEdit}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-600"
                    placeholder="/dashboard"
                  />
                </div>
              </div>
            </div>

            {/* Colonne droite: Aperçu Notification */}
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6 h-fit">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Aperçu Notification Push</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {communication.notification_title ? (
                  <div className="bg-white rounded-lg shadow-md p-4 max-w-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <img src="/images/logo.svg" alt="PronoHub" className="w-8 h-8" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 mb-1">PronoHub</p>
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          {communication.notification_title}
                        </p>
                        {communication.notification_body && (
                          <p className="text-sm text-gray-600">
                            {communication.notification_body}
                          </p>
                        )}
                        {communication.notification_image_url && (
                          <div className="mt-2">
                            <img
                              src={communication.notification_image_url}
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
          </div>
        </div>
      </main>
    </div>
  )
}
