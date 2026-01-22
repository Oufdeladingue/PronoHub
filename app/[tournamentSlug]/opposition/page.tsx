import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { Suspense } from 'react'
import OppositionClient from './OppositionClient'
import OppositionCapacitorWrapper from '@/components/OppositionCapacitorWrapper'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Opposition - PronoHub',
  description: 'Consultez les pronostics, classements et statistiques de votre tournoi.',
  robots: {
    index: false,
    follow: false,
  },
}

// Détecter si la requête vient d'un WebView Android (Capacitor)
function isCapacitorRequest(userAgent: string | null): boolean {
  if (!userAgent) return false
  return /Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)
}

interface PageProps {
  params: Promise<{ tournamentSlug: string }>
}

export default async function OppositionPage({ params }: PageProps) {
  const { tournamentSlug } = await params

  // Vérifier si c'est Capacitor
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')
  const isCapacitor = isCapacitorRequest(userAgent)

  // Dans Capacitor, utiliser le wrapper client
  if (isCapacitor) {
    return <OppositionCapacitorWrapper tournamentSlug={tournamentSlug} />
  }

  const supabase = await createClient()

  // Extraire le code du slug (format: nomtournoi_ABCDEFGH)
  const tournamentCode = tournamentSlug.split('_').pop()?.toUpperCase() || ''

  // ========== GROUPE 1: Requêtes parallèles de base ==========
  const [
    { data: { user } },
    { data: tournamentData, error: tournamentError },
    { data: pointsSettingsData }
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('tournaments')
      .select('*')
      .eq('slug', tournamentCode)
      .single(),
    supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['points_exact_score', 'points_correct_result', 'points_incorrect_result'])
  ])

  if (!user) {
    redirect('/auth/login')
  }

  if (tournamentError || !tournamentData) {
    redirect('/dashboard')
  }

  // ========== GROUPE 2: Requêtes dépendant du tournoi et user ==========
  const [
    { data: profile },
    competitionNameResult,
    captainProfileResult,
    competitionLogoResult,
    matchesResult
  ] = await Promise.all([
    // Profil utilisateur
    supabase
      .from('profiles')
      .select('username, avatar')
      .eq('id', user.id)
      .single(),
    // Nom de la compétition
    (async () => {
      if (tournamentData.custom_competition_id) {
        const { data } = await supabase
          .from('custom_competitions')
          .select('name')
          .eq('id', tournamentData.custom_competition_id)
          .single()
        return data?.name || 'Compétition Custom'
      } else if (tournamentData.competition_id) {
        const { data } = await supabase
          .from('competitions')
          .select('name')
          .eq('id', tournamentData.competition_id)
          .single()
        return data?.name || 'Compétition'
      }
      return 'Compétition'
    })(),
    // Pseudo du capitaine
    tournamentData.creator_id
      ? supabase
          .from('profiles')
          .select('username')
          .eq('id', tournamentData.creator_id)
          .single()
      : Promise.resolve({ data: null }),
    // Logo de la compétition
    (async () => {
      if (tournamentData.custom_competition_id) {
        const { data } = await supabase
          .from('custom_competitions')
          .select('custom_emblem_white, custom_emblem_color')
          .eq('id', tournamentData.custom_competition_id)
          .single()
        return {
          logo: data?.custom_emblem_color || null,
          logoWhite: data?.custom_emblem_white || null
        }
      } else if (tournamentData.competition_id) {
        const { data } = await supabase
          .from('competitions')
          .select('emblem, custom_emblem_white, custom_emblem_color')
          .eq('id', tournamentData.competition_id)
          .single()
        return {
          logo: data?.custom_emblem_color || data?.emblem || null,
          logoWhite: data?.custom_emblem_white || data?.emblem || null
        }
      }
      return { logo: null, logoWhite: null }
    })(),
    // Tous les matchs du tournoi
    fetchAllMatchesServer(supabase, tournamentData)
  ])

  // Construire l'objet tournament avec le nom de compétition
  const tournament = {
    ...tournamentData,
    competition_name: competitionNameResult
  }

  // Parser les paramètres de points
  const pointsSettings = {
    exactScore: 3,
    correctResult: 1,
    incorrectResult: 0
  }
  if (pointsSettingsData) {
    const exactScoreSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_exact_score')
    const correctResultSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_correct_result')
    const incorrectResultSetting = pointsSettingsData.find((s: any) => s.setting_key === 'points_incorrect_result')
    pointsSettings.exactScore = parseInt(exactScoreSetting?.setting_value || '3')
    pointsSettings.correctResult = parseInt(correctResultSetting?.setting_value || '1')
    pointsSettings.incorrectResult = parseInt(incorrectResultSetting?.setting_value || '0')
  }

  // Calculer les stages par matchday
  const matchdayStages: Record<number, string | null> = {}
  matchesResult.forEach((match: any) => {
    if (match.matchday && !matchdayStages[match.matchday]) {
      matchdayStages[match.matchday] = match.stage || null
    }
  })

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400" />
    </div>}>
      <OppositionClient
        serverTournament={tournament}
        serverUser={{
          id: user.id,
          username: profile?.username || 'utilisateur',
          avatar: profile?.avatar || 'avatar1'
        }}
        serverPointsSettings={pointsSettings}
        serverCompetitionLogo={competitionLogoResult.logo}
        serverCompetitionLogoWhite={competitionLogoResult.logoWhite}
        serverCaptainUsername={captainProfileResult?.data?.username || null}
        serverAllMatches={matchesResult}
        serverMatchdayStages={matchdayStages}
        tournamentSlug={tournamentSlug}
      />
    </Suspense>
  )
}

// Fonction server-side pour récupérer tous les matchs
async function fetchAllMatchesServer(supabase: any, tournament: any) {
  const startMatchday = tournament.starting_matchday
  const endMatchday = tournament.ending_matchday

  if (!startMatchday || !endMatchday) {
    return []
  }

  let matchesData: any[] = []

  if (tournament.custom_competition_id) {
    // Compétition custom - récupérer matchdays et matchs en parallèle si possible
    const { data: matchdaysData } = await supabase
      .from('custom_competition_matchdays')
      .select('id, matchday_number')
      .eq('custom_competition_id', tournament.custom_competition_id)
      .gte('matchday_number', startMatchday)
      .lte('matchday_number', endMatchday)

    if (matchdaysData && matchdaysData.length > 0) {
      const matchdayIds = matchdaysData.map((md: any) => md.id)
      const matchdayNumberMap = matchdaysData.reduce((acc: any, md: any) => {
        acc[md.id] = md.matchday_number
        return acc
      }, {})

      // Récupérer les matchs custom
      const { data: customMatches } = await supabase
        .from('custom_competition_matches')
        .select(`
          id,
          custom_matchday_id,
          football_data_match_id,
          imported_match_id,
          display_order,
          cached_utc_date,
          cached_home_team,
          cached_away_team,
          cached_home_logo,
          cached_away_logo,
          cached_competition_name
        `)
        .in('custom_matchday_id', matchdayIds)
        .order('display_order', { ascending: true })

      // Récupérer les IDs football_data pour faire la jointure
      const footballDataIds = (customMatches || [])
        .map((m: any) => m.football_data_match_id)
        .filter((id: any) => id !== null)

      // Récupérer les matchs importés via football_data_match_id
      let importedMatchesMap: Record<number, any> = {}
      if (footballDataIds.length > 0) {
        const { data: importedMatches } = await supabase
          .from('imported_matches')
          .select(`
            id,
            football_data_match_id,
            home_team_name,
            away_team_name,
            home_team_crest,
            away_team_crest,
            utc_date,
            status,
            home_score,
            away_score,
            finished,
            stage,
            competition_id,
            competitions (
              id,
              name,
              emblem,
              custom_emblem_white,
              custom_emblem_color
            )
          `)
          .in('football_data_match_id', footballDataIds)

        if (importedMatches) {
          importedMatchesMap = importedMatches.reduce((acc: any, im: any) => {
            acc[im.football_data_match_id] = im
            return acc
          }, {})
        }
      }

      // Transformer les matchs custom
      matchesData = (customMatches || []).map((match: any) => {
        const im = importedMatchesMap[match.football_data_match_id]
        const comp = im?.competitions
        return {
          id: im?.id || match.id,
          custom_match_id: match.id,
          matchday: matchdayNumberMap[match.custom_matchday_id],
          utc_date: im?.utc_date || match.cached_utc_date,
          home_team_name: im?.home_team_name || match.cached_home_team,
          away_team_name: im?.away_team_name || match.cached_away_team,
          home_team_crest: im?.home_team_crest || match.cached_home_logo,
          away_team_crest: im?.away_team_crest || match.cached_away_logo,
          status: im?.status || 'SCHEDULED',
          finished: im?.finished || false,
          home_score: im?.home_score ?? null,
          away_score: im?.away_score ?? null,
          stage: im?.stage || null,
          competition_name: comp?.name || match.cached_competition_name || null,
          competition_emblem: comp?.custom_emblem_color || comp?.emblem || null,
          competition_emblem_white: comp?.custom_emblem_white || comp?.emblem || null
        }
      }).sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())
    }
  } else if (tournament.competition_id) {
    // Compétition importée classique
    const { data: allMatchesData } = await supabase
      .from('imported_matches')
      .select('*')
      .eq('competition_id', tournament.competition_id)
      .gte('matchday', startMatchday)
      .lte('matchday', endMatchday)
      .order('utc_date', { ascending: true })

    matchesData = allMatchesData || []
  }

  return matchesData
}
