'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Navigation from '@/components/Navigation'
import { getAdminUrl } from '@/lib/admin-path'
import TargetingSelector from '@/components/admin/TargetingSelector'
import EmojiPicker from '@/components/admin/EmojiPicker'
import EmailEditor from '@/components/admin/EmailEditor'
import { EMAIL_TEMPLATES, buildEmailHtml, type TargetingFilters } from '@/lib/admin/email-templates'

interface Communication {
  id: string
  title: string
  status: 'draft' | 'scheduled' | 'sent' | 'failed'
  email_template_id: string | null
  email_content_html: string | null
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
  stats_total_recipients: number
  stats_emails_sent: number
  stats_emails_failed: number
  stats_push_sent: number
  stats_push_failed: number
}

export default function EditCommunicationPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const communicationId = params.id as string
  const showStats = searchParams.get('tab') === 'stats'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [communication, setCommunication] = useState<Communication | null>(null)
  const [recipientCount, setRecipientCount] = useState({ total: 0, email: 0, push: 0 })
  const [countingRecipients, setCountingRecipients] = useState(false)
  const [activeEmojiField, setActiveEmojiField] = useState<string | null>(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sendChannels, setSendChannels] = useState({ email: true, push: true })
  const [sendResult, setSendResult] = useState<{
    totalSent: number
    emailsSent: number
    emailsFailed: number
    pushSent: number
    pushFailed: number
  } | null>(null)
  const [showRecipientList, setShowRecipientList] = useState(false)
  const [recipientList, setRecipientList] = useState<Array<{ id: string; username: string; email: string; hasFcmToken: boolean }>>([])
  const [excludedUserIds, setExcludedUserIds] = useState<Set<string>>(new Set())
  const [loadingRecipients, setLoadingRecipients] = useState(false)

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

  const handleChange = (field: keyof Communication, value: string | boolean) => {
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

  // Mode legacy = pas de email_content_html (ancien record avec HTML brut)
  const isLegacy = communication ? !communication.email_content_html && !!communication.email_body_html : false

  // Construire le HTML complet (template + contenu)
  const getFullEmailHtml = () => {
    if (!communication) return ''
    if (isLegacy) return communication.email_body_html || ''
    return buildEmailHtml(
      communication.email_template_id || null,
      communication.email_content_html || '',
      communication.email_cta_text || undefined,
      communication.email_cta_url || undefined,
      communication.email_subject || undefined
    )
  }

  const handleSave = async () => {
    if (!communication || !communication.title.trim()) {
      alert('Le titre est obligatoire')
      return
    }

    setSaving(true)
    const supabase = createClient()

    // Recombiner template + contenu pour email_body_html
    const fullHtml = getFullEmailHtml()

    const { error } = await supabase
      .from('admin_communications')
      .update({
        title: communication.title,
        email_template_id: communication.email_template_id || null,
        email_content_html: communication.email_content_html || null,
        email_subject: communication.email_subject || null,
        email_body_html: fullHtml || null,
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

  const handleOpenSendModal = () => {
    if (!communication) return

    if (!communication.email_subject && !communication.notification_title) {
      alert('Vous devez remplir au moins un contenu (email ou notification)')
      return
    }

    // Initialiser les canaux (les deux cochés par défaut)
    setSendChannels({
      email: true,
      push: true
    })
    setShowRecipientList(false)
    setRecipientList([])
    setExcludedUserIds(new Set())
    setShowSendModal(true)
  }

  const handleShowRecipientList = async () => {
    if (!communication) return
    setLoadingRecipients(true)
    try {
      const response = await fetch('/api/admin/communications/count-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targeting_filters: communication.targeting_filters || {},
          includeList: true
        })
      })
      const data = await response.json()
      if (data.success && data.recipients) {
        setRecipientList(data.recipients)
        setShowRecipientList(true)
      }
    } catch (error) {
      console.error('Error fetching recipients:', error)
    } finally {
      setLoadingRecipients(false)
    }
  }

  const toggleRecipient = (userId: string) => {
    setExcludedUserIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleSendNow = async () => {
    if (!communication) return

    // Vérifier qu'au moins un canal est sélectionné
    if (!sendChannels.email && !sendChannels.push) {
      alert('Vous devez sélectionner au moins un canal d\'envoi')
      return
    }

    // Vérifier que le contenu correspond aux canaux sélectionnés
    if (sendChannels.email && !communication.email_subject) {
      alert('Vous devez remplir le contenu email si vous voulez envoyer par email')
      return
    }

    if (sendChannels.push && !communication.notification_title) {
      alert('Vous devez remplir le contenu push si vous voulez envoyer des notifications push')
      return
    }

    setShowSendModal(false)
    setSending(true)

    try {
      // Envoyer avec les canaux sélectionnés passés directement
      const response = await fetch('/api/admin/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communicationId,
          sendEmail: sendChannels.email,
          sendPush: sendChannels.push,
          excludeUserIds: excludedUserIds.size > 0 ? Array.from(excludedUserIds) : undefined
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }

      setSendResult({
        totalSent: data.totalSent,
        emailsSent: data.emailsSent || 0,
        emailsFailed: data.emailsFailed || 0,
        pushSent: data.pushSent || 0,
        pushFailed: data.pushFailed || 0
      })
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

  // Allow editing all communications (including sent ones) to resend with different filters
  const canEdit = true

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
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">
                Modifier la communication
              </h1>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                {communication.status === 'sent' ? 'Communication envoyée - Modifiable et renvoyable' : 'Brouillon'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => router.push(`${getAdminUrl()}/communications`)}
                className="px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Retour
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button
                onClick={handleOpenSendModal}
                disabled={sending}
                className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 text-sm sm:text-base"
              >
                {sending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Envoi...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                    <span className="hidden sm:inline">{communication.status === 'sent' ? 'Renvoyer' : 'Envoyer maintenant'}</span>
                    <span className="sm:hidden">{communication.status === 'sent' ? 'Renvoyer' : 'Envoyer'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Statistiques d'envoi (visible quand communication envoyée) */}
          {communication.status === 'sent' && (showStats || communication.stats_total_recipients > 0) && (
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Statistiques d'envoi</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-blue-50 rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-blue-700">{communication.stats_total_recipients}</p>
                  <p className="text-xs sm:text-sm text-blue-600 mt-1">Destinataires</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-green-700">{communication.stats_emails_sent}</p>
                  <p className="text-xs sm:text-sm text-green-600 mt-1">Emails envoyés</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-purple-700">{communication.stats_push_sent}</p>
                  <p className="text-xs sm:text-sm text-purple-600 mt-1">Push envoyés</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 sm:p-4 text-center">
                  <p className="text-2xl sm:text-3xl font-bold text-red-700">{communication.stats_emails_failed + communication.stats_push_failed}</p>
                  <p className="text-xs sm:text-sm text-red-600 mt-1">Échecs</p>
                </div>
              </div>
              {communication.sent_at && (
                <p className="text-xs text-gray-500 mt-3">
                  Envoyé le {new Date(communication.sent_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
            </div>
          )}

          {/* Informations générales - Pleine largeur */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
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
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Ciblage des destinataires</h2>

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

          {/* Email + Aperçu - Grid 2 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne gauche: Contenu Email */}
            <div className="space-y-6">
              {/* Template (seulement pour new-style) */}
              {!isLegacy && (
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Template Email</h2>
                  <select
                    value={communication.email_template_id || ''}
                    onChange={(e) => {
                      const templateId = e.target.value
                      const template = EMAIL_TEMPLATES.find(t => t.id === templateId)
                      handleChange('email_template_id', templateId)
                      if (template && !communication.email_content_html) {
                        handleChange('email_content_html', template.defaultContent)
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
                  >
                    <option value="">-- Aucun template --</option>
                    {EMAIL_TEMPLATES.filter(t => t.id !== 'blank').map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Contenu Email</h2>

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

                  {isLegacy ? (
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
                  ) : (
                    <EmailEditor
                      value={communication.email_content_html || ''}
                      onChange={(value) => handleChange('email_content_html', value)}
                    />
                  )}

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
            </div>

            {/* Colonne droite: Aperçu Email */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 lg:sticky lg:top-6 h-fit">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Aperçu Email</h2>

              <div className="border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                {communication.email_subject || communication.email_content_html || communication.email_body_html ? (
                  <div className="space-y-3">
                    <div className="px-4 pt-4">
                      <p className="text-xs text-gray-500">Sujet:</p>
                      <p className="font-semibold text-gray-900">{previewText(communication.email_subject || '')}</p>
                    </div>
                    {communication.email_preview_text && (
                      <div className="px-4">
                        <p className="text-xs text-gray-500">Prévisualisation:</p>
                        <p className="text-sm text-gray-600">{previewText(communication.email_preview_text)}</p>
                      </div>
                    )}
                    {(communication.email_content_html || communication.email_body_html) && (
                      <div className="border-t border-gray-200">
                        <p className="text-xs text-gray-500 px-4 pt-3 mb-2">Corps:</p>
                        {!isLegacy && communication.email_template_id && communication.email_template_id !== 'blank' ? (
                          <iframe
                            srcDoc={previewText(getFullEmailHtml())}
                            className="w-full border-0"
                            style={{ minHeight: '200px' }}
                            title="Aperçu email"
                            onLoad={(e) => {
                              const iframe = e.target as HTMLIFrameElement
                              if (iframe.contentDocument?.body) {
                                iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px'
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="prose prose-sm max-w-none px-4 pb-4"
                            dangerouslySetInnerHTML={{ __html: previewText(isLegacy ? (communication.email_body_html || '') : (communication.email_content_html || '')) }}
                          />
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 italic px-4 pb-3">
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
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Contenu Notification Push</h2>

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
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 lg:sticky lg:top-6 h-fit">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Aperçu Notification Push</h2>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                {communication.notification_title ? (
                  <div className="bg-white rounded-lg shadow-md p-4 max-w-sm">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
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

      {/* Modale de confirmation d'envoi */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* En-tête */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Confirmer l'envoi</h3>
                  <p className="text-green-100 text-sm mt-1">Choisissez les canaux de diffusion</p>
                </div>
              </div>
            </div>

            {/* Contenu */}
            <div className="p-6 space-y-6">
              {/* Statistiques */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-3">Cette communication sera envoyée à :</p>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-gray-900">{recipientCount.total}</p>
                    <p className="text-xs text-gray-500 mt-1">Destinataires</p>
                  </div>
                </div>
              </div>

              {/* Choix des canaux */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Canaux d'envoi *
                </label>

                {/* Option Email */}
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  sendChannels.email
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendChannels.email}
                    onChange={(e) => setSendChannels(prev => ({ ...prev, email: e.target.checked }))}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📧</span>
                      <span className="font-medium text-gray-900">Email</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{recipientCount.email} destinataires avec email</p>
                  </div>
                  {sendChannels.email && (
                    <div className="bg-purple-500 text-white rounded-full p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </label>

                {/* Option Push */}
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  sendChannels.push
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendChannels.push}
                    onChange={(e) => setSendChannels(prev => ({ ...prev, push: e.target.checked }))}
                    className="w-5 h-5 text-purple-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">📱</span>
                      <span className="font-medium text-gray-900">Notification Push</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{recipientCount.push} destinataires avec app mobile</p>
                  </div>
                  {sendChannels.push && (
                    <div className="bg-purple-500 text-white rounded-full p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </label>

                {/* Avertissement si aucun canal */}
                {!sendChannels.email && !sendChannels.push && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-xs text-red-700">Vous devez sélectionner au moins un canal d'envoi</p>
                  </div>
                )}
              </div>

              {/* Bouton voir la liste / liste des destinataires */}
              <div>
                {!showRecipientList ? (
                  <button
                    type="button"
                    onClick={handleShowRecipientList}
                    disabled={loadingRecipients}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1.5"
                  >
                    {loadingRecipients ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-purple-600 border-t-transparent" />
                        Chargement...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        Voir la liste des destinataires
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        Destinataires ({recipientList.length - excludedUserIds.size}/{recipientList.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRecipientList(false)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Masquer
                      </button>
                    </div>
                    {excludedUserIds.size > 0 && (
                      <p className="text-xs text-orange-600">
                        {excludedUserIds.size} utilisateur{excludedUserIds.size > 1 ? 's' : ''} exclu{excludedUserIds.size > 1 ? 's' : ''}
                      </p>
                    )}
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                      {recipientList.map(r => (
                        <label
                          key={r.id}
                          className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                            excludedUserIds.has(r.id) ? 'opacity-50 bg-gray-50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!excludedUserIds.has(r.id)}
                            onChange={() => toggleRecipient(r.id)}
                            className="w-4 h-4 text-purple-600 rounded shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate block">{r.username}</span>
                            <span className="text-xs text-gray-500 truncate block">{r.email}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs" title="Email">📧</span>
                            {r.hasFcmToken && <span className="text-xs" title="Push">📱</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSendNow}
                disabled={!sendChannels.email && !sendChannels.push}
                className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
                Confirmer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de résultat d'envoi */}
      {sendResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* En-tête */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">Envoi terminé !</h3>
              <p className="text-green-100 text-sm mt-1">{sendResult.totalSent} destinataire{sendResult.totalSent > 1 ? 's' : ''}</p>
            </div>

            {/* Stats */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {(sendResult.emailsSent > 0 || sendResult.emailsFailed > 0) && (
                  <>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-700">{sendResult.emailsSent}</p>
                      <p className="text-xs text-green-600 mt-1">Emails envoyés</p>
                    </div>
                    {sendResult.emailsFailed > 0 && (
                      <div className="bg-red-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-700">{sendResult.emailsFailed}</p>
                        <p className="text-xs text-red-600 mt-1">Emails échoués</p>
                      </div>
                    )}
                  </>
                )}
                {(sendResult.pushSent > 0 || sendResult.pushFailed > 0) && (
                  <>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-purple-700">{sendResult.pushSent}</p>
                      <p className="text-xs text-purple-600 mt-1">Push envoyés</p>
                    </div>
                    {sendResult.pushFailed > 0 && (
                      <div className="bg-red-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-red-700">{sendResult.pushFailed}</p>
                        <p className="text-xs text-red-600 mt-1">Push échoués</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="bg-gray-50 px-6 py-4">
              <button
                onClick={() => {
                  setSendResult(null)
                  router.push(`${getAdminUrl()}/communications`)
                }}
                className="w-full px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Retour aux communications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
