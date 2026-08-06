'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area_name: string
  custom_emblem_white: string | null
  custom_emblem_color: string | null
}

interface CustomCompetition {
  id: string
  name: string
  code: string
  custom_emblem_white: string | null
  custom_emblem_color: string | null
}

export default function LogosManagementPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [customCompetitions, setCustomCompetitions] = useState<CustomCompetition[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{[key: string]: 'white' | 'color' | null}>({})
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchCompetitions()
    fetchCustomCompetitions()
  }, [])

  const fetchCompetitions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .order('name')

      if (error) throw error
      setCompetitions(data || [])
    } catch (error: any) {
      console.error('Erreur:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomCompetitions = async () => {
    try {
      // Utiliser l'API admin qui a les bons droits (le client Supabase ne peut pas lire cette table directement)
      const response = await fetch('/api/admin/custom-competitions')
      if (!response.ok) throw new Error('Failed to fetch custom competitions')

      const data = await response.json()
      setCustomCompetitions(data.competitions || [])
    } catch (error: any) {
      console.error('Erreur custom competitions:', error)
    }
  }

  const handleFileUpload = async (competitionId: number | string, file: File, type: 'white' | 'color', isCustom: boolean = false) => {
    if (!file) return

    // Vérifier le type de fichier
    const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: 'error', text: 'Type de fichier non autorisé. Utilisez SVG, PNG, JPG ou WEBP.' })
      return
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Fichier trop volumineux. Maximum 5MB.' })
      return
    }

    const uploadKey = isCustom ? `custom_${competitionId}` : String(competitionId)
    setUploading(prev => ({ ...prev, [uploadKey]: type }))
    setMessage(null)

    try {
      // Utiliser l'API route pour uploader avec le service role
      const formData = new FormData()
      formData.append('file', file)
      formData.append('competitionId', competitionId.toString())
      formData.append('type', type)
      formData.append('isCustom', isCustom ? 'true' : 'false')

      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'upload')
      }

      setMessage({ type: 'success', text: result.message })

      // Rafraîchir les listes
      fetchCompetitions()
      fetchCustomCompetitions()
    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: null }))
    }
  }

  const handleRemoveLogo = async (competitionId: number | string, type: 'white' | 'color', isCustom: boolean = false) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ce logo ${type === 'white' ? 'blanc' : 'couleur'} ?`)) {
      return
    }

    try {
      // Utiliser l'API admin pour supprimer (bypass RLS)
      const response = await fetch(
        `/api/admin/upload-logo?competitionId=${competitionId}&type=${type}&isCustom=${isCustom}`,
        { method: 'DELETE' }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error)

      setMessage({ type: 'success', text: result.message })
      // Rafraîchir les listes
      fetchCompetitions()
      fetchCustomCompetitions()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  // Composant réutilisable pour afficher une compétition
  const renderCompetitionCard = (comp: Competition | CustomCompetition, isCustom: boolean = false) => {
    const uploadKey = isCustom ? `custom_${comp.id}` : String(comp.id)

    return (
      <div key={comp.id} className="border-b border-gray-200 pb-8 last:border-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {isCustom && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <Sparkles className="w-3 h-3" />
                  Custom
                </span>
              )}
              {comp.name}
            </h3>
            <p className="text-sm text-gray-500">
              {isCustom ? 'Best of Week' : (comp as Competition).area_name} • {comp.code}
            </p>
          </div>
          {!isCustom && (comp as Competition).emblem && (
            <img src={(comp as Competition).emblem!} alt={comp.name} className="w-16 h-16 object-contain" />
          )}
          {isCustom && (
            comp.custom_emblem_color ? (
              <img src={comp.custom_emblem_color} alt={comp.name} className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-2 border-purple-500/50">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
            )
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo blanc */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Logo Blanc (fond sombre)
            </h4>

            {comp.custom_emblem_white ? (
              <div className="space-y-3">
                <div className="bg-gray-800 p-4 rounded flex items-center justify-center" style={{ minHeight: '120px' }}>
                  <img src={comp.custom_emblem_white} alt="Logo blanc" className="max-w-full max-h-28 object-contain" />
                </div>
                <button
                  onClick={() => handleRemoveLogo(comp.id, 'white', isCustom)}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-8 text-center">
                  <p className="text-sm text-gray-500 mb-3">Aucun logo blanc</p>
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(comp.id, file, 'white', isCustom)
                    }}
                    disabled={uploading[uploadKey] === 'white'}
                    className="hidden"
                  />
                  <span className="block w-full px-3 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition-colors cursor-pointer text-sm">
                    {uploading[uploadKey] === 'white' ? 'Upload en cours...' : 'Uploader un logo blanc'}
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Logo couleur */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Logo Couleur (fond clair)
            </h4>

            {comp.custom_emblem_color ? (
              <div className="space-y-3">
                <div className="bg-white border border-gray-200 p-4 rounded flex items-center justify-center" style={{ minHeight: '120px' }}>
                  <img src={comp.custom_emblem_color} alt="Logo couleur" className="max-w-full max-h-28 object-contain" />
                </div>
                <button
                  onClick={() => handleRemoveLogo(comp.id, 'color', isCustom)}
                  className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-8 text-center">
                  <p className="text-sm text-gray-500 mb-3">Aucun logo couleur</p>
                </div>
                <label className="block">
                  <input
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(comp.id, file, 'color', isCustom)
                    }}
                    disabled={uploading[uploadKey] === 'color'}
                    className="hidden"
                  />
                  <span className="block w-full px-3 py-2 bg-green-600 text-white text-center rounded hover:bg-green-700 transition-colors cursor-pointer text-sm">
                    {uploading[uploadKey] === 'color' ? 'Upload en cours...' : 'Uploader un logo couleur'}
                  </span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AdminLayout currentPage="logos">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout currentPage="logos">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Gestion des logos des compétitions</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <p className="text-gray-600 mb-6">
          {competitions.length + customCompetitions.length} compétition(s) au total
        </p>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-8">
            {competitions.length === 0 && customCompetitions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Aucune compétition</p>
            ) : (
              <>
                {/* Compétitions custom en premier */}
                {customCompetitions.map(comp => renderCompetitionCard(comp, true))}
                {/* Puis les compétitions importées */}
                {competitions.map(comp => renderCompetitionCard(comp, false))}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
