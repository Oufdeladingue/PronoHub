'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Competition {
  id: number
  name: string
  code: string
  emblem: string | null
  area_name: string
  current_matchday: number
  current_season_start_date: string
  current_season_end_date: string
  is_active: boolean
  remaining_matchdays?: number
  remaining_matches?: number
}

export default function VestiairePage() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Traduction des noms de pays en français
  const translateCountryName = (englishName: string): string => {
    const translations: Record<string, string> = {
      'Germany': 'Allemagne',
      'England': 'Angleterre',
      'Spain': 'Espagne',
      'France': 'France',
      'Italy': 'Italie',
      'Netherlands': 'Pays-Bas',
      'Portugal': 'Portugal',
      'Brazil': 'Brésil',
      'Argentina': 'Argentine',
      'Belgium': 'Belgique',
      'Europe': 'Europe',
      'World': 'Monde',
      'Scotland': 'Écosse',
      'Turkey': 'Turquie',
      'Greece': 'Grèce',
      'Switzerland': 'Suisse',
      'Austria': 'Autriche',
      'Denmark': 'Danemark',
      'Sweden': 'Suède',
      'Norway': 'Norvège',
      'Poland': 'Pologne',
      'Croatia': 'Croatie',
      'Czech Republic': 'République tchèque',
      'Russia': 'Russie',
      'Ukraine': 'Ukraine',
      'Mexico': 'Mexique',
      'United States': 'États-Unis',
      'Japan': 'Japon',
      'South Korea': 'Corée du Sud',
      'China': 'Chine',
      'Australia': 'Australie',
      'South Africa': 'Afrique du Sud',
      'Egypt': 'Égypte',
      'Morocco': 'Maroc',
      'Algeria': 'Algérie',
      'Tunisia': 'Tunisie',
      'Chile': 'Chili',
      'Uruguay': 'Uruguay',
      'Colombia': 'Colombie',
      'Peru': 'Pérou',
      'Venezuela': 'Venezuela',
      'Ecuador': 'Équateur',
      'Paraguay': 'Paraguay',
      'Bolivia': 'Bolivie',
      'Romania': 'Roumanie',
      'Serbia': 'Serbie',
      'Hungary': 'Hongrie',
      'Bulgaria': 'Bulgarie',
      'Slovakia': 'Slovaquie',
      'Slovenia': 'Slovénie',
      'Finland': 'Finlande',
      'Ireland': 'Irlande',
      'Northern Ireland': 'Irlande du Nord',
      'Wales': 'Pays de Galles',
      'Iceland': 'Islande',
    }
    return translations[englishName] || englishName
  }

  useEffect(() => {
    fetchActiveCompetitions()
  }, [])

  const fetchActiveCompetitions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/competitions/active')
      if (!response.ok) throw new Error('Erreur lors du chargement des compétitions')

      const data = await response.json()
      setCompetitions(data.competitions || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              PronoHub
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="text-gray-500">Chargement des compétitions...</div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              PronoHub
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6">
            <strong>Erreur :</strong> {error}
          </div>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Retour au dashboard
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
            PronoHub
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
          >
            Retour
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Le Vestiaire</h1>
          <p className="text-lg text-gray-600">
            Choisissez une compétition pour créer votre tournoi de pronostics
          </p>
        </div>

        {/* Liste des compétitions */}
        {competitions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              Aucune compétition disponible pour le moment.
            </div>
            <p className="text-sm text-gray-400">
              Les compétitions doivent être activées par un administrateur.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '24px',
            padding: '0 20px'
          }}>
            {competitions.map((comp) => (
              <div
                key={comp.id}
                onClick={() => router.push(`/vestiaire/create/${comp.id}`)}
                style={{
                  width: '280px',
                  backgroundColor: '#ffffff',
                  border: '2px solid #d1d5db',
                  borderRadius: '16px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
                className="group"
                onMouseEnter={(e) => {
                  e.currentTarget.style.border = '2px solid #9ca3af'
                  e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.border = '2px solid #d1d5db'
                  e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Effet lumineux en hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ pointerEvents: 'none' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-transparent to-blue-400/10"></div>
                  <div className="absolute -inset-full group-hover:inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-all duration-1000 transform -skew-x-12"></div>
                </div>

                {/* Contenu de la tuile */}
                <div style={{ position: 'relative', zIndex: 10, width: '100%', textAlign: 'center' }}>
                  {/* Logo */}
                  <div style={{
                    width: '120px',
                    height: '120px',
                    margin: '0 auto 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {comp.emblem ? (
                      <img
                        src={comp.emblem}
                        alt={comp.name}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          transition: 'transform 0.3s ease'
                        }}
                        className="group-hover:scale-110"
                      />
                    ) : (
                      <div style={{
                        width: '100px',
                        height: '100px',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af',
                        fontWeight: 'bold',
                        fontSize: '24px'
                      }}>
                        {comp.code}
                      </div>
                    )}
                  </div>

                  {/* Nom de la compétition */}
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: '4px',
                    minHeight: '2.5rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {comp.name}
                  </h3>

                  {/* Pays/Zone */}
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '8px'
                  }}>
                    {translateCountryName(comp.area_name)}
                  </p>

                  {/* Journées restantes */}
                  {comp.remaining_matchdays !== undefined && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px solid #f3f4f6'
                    }}>
                      <p style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#059669'
                      }}>
                        {comp.remaining_matchdays === 0
                          ? 'Aucune journée restante'
                          : comp.remaining_matchdays === 1
                          ? '1 journée restante'
                          : `${comp.remaining_matchdays} journées restantes`
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
