import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminNav from '@/components/AdminNav'
import JoinTournamentButton from '@/components/JoinTournamentButton'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // Récupérer le profil utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const isSuper = isSuperAdmin(profile?.role as UserRole)

  // Récupérer la limite de tournois depuis les paramètres admin
  const { data: maxTournamentsSettings } = await supabase
    .from('admin_settings')
    .select('setting_value')
    .eq('setting_key', 'max_tournaments_per_user')
    .single()

  const maxTournaments = parseInt(maxTournamentsSettings?.setting_value || '3')

  // Récupérer les IDs des tournois auxquels l'utilisateur participe
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', user.id)

  const tournamentIds = participations?.map(p => p.tournament_id) || []
  const currentTournamentCount = tournamentIds.length
  const hasReachedLimit = currentTournamentCount >= maxTournaments

  // Récupérer les détails des tournois
  const { data: userTournaments } = await supabase
    .from('tournaments')
    .select('id, name, slug, invite_code, competition_id, competition_name, creator_id, status, current_participants, max_participants, max_players, num_matchdays, matchdays_count')
    .in('id', tournamentIds)

  // Récupérer les IDs de compétitions
  const competitionIds = userTournaments?.map((t: any) => t.competition_id).filter(Boolean) || []

  // Récupérer les emblèmes des compétitions
  let competitionsMap: Record<number, string> = {}
  if (competitionIds.length > 0) {
    const { data: competitions } = await supabase
      .from('competitions')
      .select('id, emblem')
      .in('id', competitionIds)

    if (competitions) {
      competitionsMap = competitions.reduce((acc: any, comp: any) => {
        acc[comp.id] = comp.emblem
        return acc
      }, {})
    }
  }

  // Formater les données pour un accès plus facile
  const tournaments = userTournaments?.map((t: any) => {
    // Créer le slug complet : nom-du-tournoi_CODE
    const tournamentSlug = `${t.name.toLowerCase().replace(/\s+/g, '-')}_${t.slug || t.invite_code}`

    return {
      id: t.id,
      name: t.name,
      slug: tournamentSlug,
      code: t.slug || t.invite_code,
      competition_id: t.competition_id,
      competition_name: t.competition_name,
      creator_id: t.creator_id,
      status: t.status,
      current_participants: t.current_participants || 0,
      max_players: t.max_players || t.max_participants || 8,
      num_matchdays: t.num_matchdays || t.matchdays_count || 0,
      emblem: competitionsMap[t.competition_id],
      isCaptain: t.creator_id === user.id
    }
  }) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Menu Super Admin */}
      {isSuper && <AdminNav />}

      {/* Navigation principale */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">PronoHub</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">Bonjour, {profile?.username || 'utilisateur'} !</span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Message d'alerte si limite atteinte */}
        {hasReachedLimit && (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 text-orange-600 text-2xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-orange-900 mb-1">
                  Limite de tournois atteinte
                </h3>
                <p className="text-sm text-orange-800">
                  Vous participez actuellement à {currentTournamentCount} tournoi{currentTournamentCount > 1 ? 's' : ''}
                  (limite : {maxTournaments} en version gratuite).
                  Pour créer ou rejoindre un nouveau tournoi, vous devez d'abord quitter l'un de vos tournois existants ou passer à la version payante.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`bg-white p-6 rounded-lg shadow-lg ${hasReachedLimit ? 'opacity-60' : ''}`}>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Créer un tournoi</h2>
            <p className="text-gray-600 mb-4">
              Lancez votre propre tournoi de pronostics et invitez vos amis à participer.
            </p>
            {hasReachedLimit ? (
              <div className="w-full py-2 px-4 bg-gray-400 text-white rounded-md text-center cursor-not-allowed">
                Limite atteinte
              </div>
            ) : (
              <a href="/vestiaire" className="block w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-center">
                Nouveau tournoi
              </a>
            )}
          </div>

          <div className={`bg-white p-6 rounded-lg shadow-lg ${hasReachedLimit ? 'opacity-60' : ''}`}>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Rejoindre un tournoi</h2>
            <p className="text-gray-600 mb-4">
              Vous avez reçu un code d'invitation ? Rejoignez un tournoi existant.
            </p>
            {hasReachedLimit ? (
              <div className="w-full py-2 px-4 bg-gray-400 text-white rounded-md text-center cursor-not-allowed">
                Limite atteinte
              </div>
            ) : (
              <JoinTournamentButton />
            )}
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Mes tournois</h2>
            <span className="text-sm text-gray-500">
              (Participez jusqu'à {maxTournaments} tournois simultanés en version gratuite)
            </span>
          </div>
          {tournaments.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Vous ne participez à aucun tournoi pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {tournaments.map((tournament) => {
                // Déterminer l'URL selon le statut
                const tournamentUrl = tournament.status === 'pending' || tournament.status === 'warmup'
                  ? `/vestiaire/${tournament.slug}/echauffement`
                  : `/terrain/${tournament.slug}`

                return (
                  <a
                    key={tournament.id}
                    href={tournamentUrl}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                  >
                    {/* Logo de la compétition */}
                    {tournament.emblem ? (
                      <img
                        src={tournament.emblem}
                        alt={tournament.competition_name}
                        className="w-12 h-12 object-contain"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400 text-xs">N/A</span>
                      </div>
                    )}

                    {/* Informations du tournoi */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {tournament.name}
                        {tournament.isCaptain && (
                          <span className="text-yellow-600 font-normal"> (capitaine)</span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600">{tournament.competition_name}</p>
                    </div>

                    {/* Statut et informations */}
                    <div className="text-right">
                      {(tournament.status === 'pending' || tournament.status === 'warmup') && (
                        <div>
                          <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm inline-block mb-1">
                            À l'échauffement
                          </div>
                          <p className="text-xs text-gray-600">
                            {tournament.current_participants}/{tournament.max_players} joueurs
                          </p>
                        </div>
                      )}
                      {tournament.status === 'active' && (
                        <div>
                          <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm inline-block mb-1">
                            En plein effort
                          </div>
                          <p className="text-xs text-gray-600">
                            Journée 0/{tournament.num_matchdays}
                          </p>
                          <p className="text-xs text-gray-600">
                            {tournament.current_participants} participants
                          </p>
                        </div>
                      )}
                      {tournament.status === 'finished' && (
                        <div>
                          <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm inline-block mb-1">
                            Terminé
                          </div>
                          <p className="text-xs text-gray-600">
                            {tournament.num_matchdays} journées
                          </p>
                          <p className="text-xs text-gray-600">
                            {tournament.current_participants} participants
                          </p>
                        </div>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
