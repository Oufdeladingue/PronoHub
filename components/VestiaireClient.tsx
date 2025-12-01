'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Footer from '@/components/Footer'

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
  tournaments_count?: number
  is_most_popular?: boolean
  custom_emblem_white?: string | null
  custom_emblem_color?: string | null
}

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

// Formater la saison depuis les dates de début et fin
const formatSeason = (startDate: string, endDate: string): string => {
  const startYear = new Date(startDate).getFullYear()
  const endYear = new Date(endDate).getFullYear()

  // Si la compétition se déroule sur une seule année
  if (startYear === endYear) {
    return startYear.toString()
  }

  // Si la compétition s'étend sur deux années (championnat)
  return `${startYear}/${endYear}`
}

export default function VestiaireClient() {
  const router = useRouter()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <div className="theme-bg flex flex-col flex-1">
        <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
          <div className="text-center py-12">
            <div className="text-gray-400">Chargement des compétitions...</div>
          </div>
        </main>
        <Footer variant="full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="theme-bg flex flex-col flex-1">
        <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 text-red-200 mb-6">
            <strong>Erreur :</strong> {error}
          </div>
        </main>
        <Footer variant="full" />
      </div>
    )
  }

  return (
    <div className="theme-bg flex flex-col flex-1">
      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        {/* En-tête */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-[#ff9900] mb-4">Le Vestiaire</h1>
          <p className="text-lg text-gray-400">
            Choisissez une compétition pour créer votre tournoi de pronostics
          </p>
        </div>

        {/* Liste des compétitions */}
        {competitions.length === 0 ? (
          <div className="bg-[#0a0f1a] border border-gray-800 rounded-lg p-8 text-center">
            <div className="text-gray-400 mb-4">
              Aucune compétition disponible pour le moment.
            </div>
            <p className="text-sm text-gray-500">
              Les compétitions doivent être activées par un administrateur.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 px-5">
            {competitions.map((comp) => (
              <div
                key={comp.id}
                onClick={() => router.push(`/vestiaire/create/${comp.id}`)}
                className="group competition-badge"
              >
                {/* Badge "Plus populaire" */}
                {comp.is_most_popular && (
                  <div
                    className="popular-star absolute top-3 right-3 z-20 rounded-full p-2 shadow-lg group/star transition-colors duration-300"
                    title="Compétition la plus populaire"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="popular-tooltip absolute -bottom-10 right-0 text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none">
                      Compétition la plus populaire
                    </span>
                  </div>
                )}

                {/* Effet lumineux en hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-400/5"></div>
                  <div className="absolute -inset-full group-hover:inset-0 bg-gradient-to-r from-transparent via-orange-500/10 to-transparent transition-all duration-1000 transform -skew-x-12"></div>
                </div>

                {/* Contenu de la tuile */}
                <div className="relative z-10 w-full">
                  {/* Journées restantes - Badge en haut à gauche */}
                  {comp.remaining_matchdays !== undefined && comp.remaining_matchdays > 0 && (
                    <div className="text-left mb-2">
                      <span className="matchdays-badge inline-block text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-300">
                        {comp.remaining_matchdays === 1
                          ? '1 journée restante'
                          : `${comp.remaining_matchdays} journées restantes`
                        }
                      </span>
                    </div>
                  )}

                  <div className="text-center">
                    {/* Logo */}
                    <div className="w-full h-[160px] mx-auto mb-1 flex items-center justify-center relative">
                      {comp.custom_emblem_white || comp.custom_emblem_color || comp.emblem ? (
                        <>
                          {/* Logo blanc */}
                          <img
                            src={comp.custom_emblem_white || comp.emblem || ''}
                            alt={comp.name}
                            className="logo-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain transition-all duration-300"
                          />
                          {/* Logo couleur */}
                          {comp.custom_emblem_color && (
                            <img
                              src={comp.custom_emblem_color}
                              alt={comp.name}
                              className="logo-color absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain transition-all duration-300"
                            />
                          )}
                        </>
                      ) : (
                        <div className="w-[140px] h-[140px] bg-gray-800 rounded-full flex items-center justify-center text-gray-500 font-bold text-3xl">
                          {comp.code}
                        </div>
                      )}
                    </div>

                    {/* Nom de la compétition */}
                    <h3 className="badge-title text-base font-bold mb-0 min-h-[2rem] line-clamp-2 transition-colors duration-300">
                      {comp.name}
                    </h3>

                    {/* Saison */}
                    <p className="badge-text text-xs mb-0.5 transition-colors duration-300">
                      Saison {formatSeason(comp.current_season_start_date, comp.current_season_end_date)}
                    </p>

                    {/* Pays/Zone */}
                    <p className="badge-text text-xs mb-1 transition-colors duration-300">
                      {translateCountryName(comp.area_name)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer variant="full" />
    </div>
  )
}
