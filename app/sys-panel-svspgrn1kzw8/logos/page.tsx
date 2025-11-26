'use client'

import { useState, useEffect } from 'react'
import AdminLayout from '@/components/AdminLayout'
import { createClient } from '@/lib/supabase/client'

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area_name: string
  custom_emblem_white: string | null
  custom_emblem_color: string | null
}

export default function LogosManagementPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<{[key: number]: 'white' | 'color' | null}>({})
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchCompetitions()
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

  const handleFileUpload = async (competitionId: number, file: File, type: 'white' | 'color') => {
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

    setUploading(prev => ({ ...prev, [competitionId]: type }))
    setMessage(null)

    try {
      // Utiliser l'API route pour uploader avec le service role
      const formData = new FormData()
      formData.append('file', file)
      formData.append('competitionId', competitionId.toString())
      formData.append('type', type)

      const response = await fetch('/api/admin/upload-logo', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'upload')
      }

      setMessage({ type: 'success', text: result.message })

      // Rafraîchir la liste
      fetchCompetitions()
    } catch (error: any) {
      console.error('Erreur upload:', error)
      setMessage({ type: 'error', text: error.message })
    } finally {
      setUploading(prev => ({ ...prev, [competitionId]: null }))
    }
  }

  const handleRemoveLogo = async (competitionId: number, type: 'white' | 'color') => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ce logo ${type === 'white' ? 'blanc' : 'couleur'} ?`)) {
      return
    }

    try {
      const columnName = type === 'white' ? 'custom_emblem_white' : 'custom_emblem_color'
      const { error } = await supabase
        .from('competitions')
        .update({ [columnName]: null })
        .eq('id', competitionId)

      if (error) throw error

      setMessage({ type: 'success', text: 'Logo supprimé avec succès !' })
      fetchCompetitions()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }
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

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-8">
            {competitions.map(comp => (
              <div key={comp.id} className="border-b border-gray-200 pb-8 last:border-0">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{comp.name}</h3>
                    <p className="text-sm text-gray-500">{comp.area_name} • {comp.code}</p>
                  </div>
                  {comp.emblem && (
                    <img src={comp.emblem} alt={comp.name} className="w-16 h-16 object-contain" />
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
                          onClick={() => handleRemoveLogo(comp.id, 'white')}
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
                              if (file) handleFileUpload(comp.id, file, 'white')
                            }}
                            disabled={uploading[comp.id] === 'white'}
                            className="hidden"
                          />
                          <span className="block w-full px-3 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition-colors cursor-pointer text-sm">
                            {uploading[comp.id] === 'white' ? 'Upload en cours...' : 'Uploader un logo blanc'}
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
                          onClick={() => handleRemoveLogo(comp.id, 'color')}
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
                              if (file) handleFileUpload(comp.id, file, 'color')
                            }}
                            disabled={uploading[comp.id] === 'color'}
                            className="hidden"
                          />
                          <span className="block w-full px-3 py-2 bg-green-600 text-white text-center rounded hover:bg-green-700 transition-colors cursor-pointer text-sm">
                            {uploading[comp.id] === 'color' ? 'Upload en cours...' : 'Uploader un logo couleur'}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
