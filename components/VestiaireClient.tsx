'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Footer from '@/components/Footer'
import { Trophy, Users, Award, Check, Star, Sparkles } from 'lucide-react'

interface Competition {
  id: number | string
  name: string
  code: string
  emblem: string | null
  area_name: string
  current_matchday: number
  current_season_start_date: string
  current_season_end_date: string
  is_active: boolean
  is_event?: boolean
  remaining_matchdays?: number
  remaining_matches?: number
  tournaments_count?: number
  is_most_popular?: boolean
  custom_emblem_white?: string | null
  custom_emblem_color?: string | null
  is_custom?: boolean
  custom_competition_id?: string
  competition_type?: string
  matches_per_matchday?: number
  season?: string
  description?: string
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
  const searchParams = useSearchParams()
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Recuperer le type de tournoi depuis l'URL (apres paiement)
  const tournamentType = searchParams.get('type') as 'oneshot' | 'elite' | 'platinium' | null
  const slotsParam = searchParams.get('slots')
  const selectedSlots = slotsParam ? parseInt(slotsParam, 10) : 1

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
        <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-20 w-full flex-1">
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
        <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-20 w-full flex-1">
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
      <main className="max-w-7xl mx-auto px-4 py-8 pb-24 md:pb-20 w-full flex-1">
        {/* Message contextuel si type passe en URL (apres paiement) */}
        {tournamentType === 'oneshot' && (
          <div className="mb-6 p-4 rounded-xl border-2 border-green-500/50 bg-green-500/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-5 h-5 text-green-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-500" />
                <span className="font-semibold text-green-400">Votre credit One-Shot est pret a etre utilise !</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Selectionnez une competition pour creer votre tournoi One-Shot
              </p>
            </div>
          </div>
        )}
        {tournamentType === 'elite' && (
          <div className="mb-6 p-4 rounded-xl border-2 border-orange-500/50 bg-orange-500/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-orange-500" />
                <span className="font-semibold text-orange-400">Votre credit Elite Team est pret a etre utilise !</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Selectionnez une competition pour creer votre tournoi Elite Team
              </p>
            </div>
          </div>
        )}
        {tournamentType === 'platinium' && (
          <div className="mb-6 p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-yellow-500" />
                <span className="font-semibold text-yellow-400">
                  {selectedSlots > 1
                    ? `Vos ${selectedSlots} crédits Platinium sont prêts à être utilisés !`
                    : 'Votre crédit Platinium est prêt à être utilisé !'
                  }
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Sélectionnez une compétition pour créer votre tournoi Platinium
              </p>
            </div>
          </div>
        )}

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
            {/* Trier: compétitions actives en premier, terminées à la fin */}
            {[...competitions]
              .sort((a, b) => {
                const aFinished = (a.remaining_matchdays ?? 1) === 0
                const bFinished = (b.remaining_matchdays ?? 1) === 0
                if (aFinished && !bFinished) return 1
                if (!aFinished && bFinished) return -1
                return 0
              })
              .map((comp) => {
              const isFinished = (comp.remaining_matchdays ?? 1) === 0
              return (
              <div
                key={comp.id}
                onClick={() => {
                  // Ne pas permettre de cliquer sur une compétition terminée
                  if (isFinished) return

                  // Construire les query params
                  const params = new URLSearchParams()
                  if (tournamentType) params.set('type', tournamentType)
                  if (selectedSlots > 1) params.set('slots', selectedSlots.toString())
                  const queryString = params.toString() ? `?${params.toString()}` : ''

                  if (comp.is_custom) {
                    router.push(`/vestiaire/create/custom_${comp.custom_competition_id}${queryString}`)
                  } else {
                    router.push(`/vestiaire/create/${comp.id}${queryString}`)
                  }
                }}
                className={`group competition-badge ${comp.is_custom ? 'custom-competition' : ''} ${isFinished ? 'competition-finished' : ''}`}
              >
                {/* Badge "Plus populaire" */}
                {comp.is_most_popular && !comp.is_event && (
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

                {/* Badge "Événement" */}
                {comp.is_event && (
                  <div
                    className="event-badge absolute top-3 right-3 z-20 flex flex-col items-center gap-1 group/event"
                    title="Compétition événementielle"
                  >
                    <div className="event-icon-container rounded-full p-2 shadow-lg animate-pulse-subtle">
                      <img
                        src="/images/icons/event.svg"
                        alt="Événement"
                        className="w-5 h-5 event-icon"
                      />
                    </div>
                    <span className="event-label text-[10px] font-bold uppercase tracking-wide">
                      Événement
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
                  {/* Journées restantes - Badge en haut à gauche (toujours présent pour l'alignement) */}
                  <div className="text-left mb-2 min-h-[26px]">
                    {isFinished ? (
                      <span className="finished-badge inline-block text-xs font-semibold px-3 py-1 rounded-full bg-gray-600/50 text-gray-400">
                        Saison terminée
                      </span>
                    ) : comp.remaining_matchdays !== undefined && comp.remaining_matchdays > 0 && (
                      <span className="matchdays-badge inline-block text-xs font-semibold px-3 py-1 rounded-full transition-colors duration-300">
                        {comp.remaining_matchdays === 1
                          ? '1 journée restante'
                          : `${comp.remaining_matchdays} journées restantes`
                        }
                      </span>
                    )}
                  </div>

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
                      ) : comp.is_custom ? (
                        // Fallback pour les compétitions custom sans logo
                        <div className="w-[140px] h-[140px] rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600/20 to-purple-900/30 border-2 border-purple-500/50 group-hover:border-purple-400 transition-all duration-300">
                          <div className="relative">
                            <Sparkles className="w-16 h-16 text-purple-400 group-hover:text-purple-300 transition-colors duration-300" />
                            <Star className="w-6 h-6 text-yellow-400 absolute -top-1 -right-1 animate-pulse" />
                          </div>
                        </div>
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
                      {comp.is_custom
                        ? `Saison ${comp.season || new Date().getFullYear()}`
                        : `Saison ${formatSeason(comp.current_season_start_date, comp.current_season_end_date)}`
                      }
                    </p>

                    {/* Pays/Zone pour normale, Description pour custom */}
                    <p className="badge-text text-xs mb-1 transition-colors duration-300 line-clamp-2" title={comp.is_custom && comp.description ? comp.description : undefined}>
                      {comp.is_custom
                        ? (comp.description || (comp.competition_type === 'best_of_week' ? 'Best of Week' : 'Custom'))
                        : translateCountryName(comp.area_name)
                      }
                    </p>
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>
      <Footer variant="full" />
    </div>
  )
}
