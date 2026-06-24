-- Index pour accélérer le calcul des classements (général / journée / équipes).
-- Tous en IF NOT EXISTS → aucun risque, n'altèrent pas les résultats (seulement la vitesse).

-- Requête pronos du classement : .eq('tournament_id', X).in('match_id', [...])
CREATE INDEX IF NOT EXISTS idx_predictions_tournament_match
  ON public.predictions(tournament_id, match_id);

-- Branche ligue : .eq('competition_id', X).in('matchday', [...])
CREATE INDEX IF NOT EXISTS idx_imported_matches_comp_matchday
  ON public.imported_matches(competition_id, matchday);

-- Matchs bonus : .eq('tournament_id', X).in('matchday', [...])
CREATE INDEX IF NOT EXISTS idx_tournament_bonus_matches_tournament_md
  ON public.tournament_bonus_matches(tournament_id, matchday);

-- Membres d'équipe : .in('team_id', [...])
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_team
  ON public.tournament_team_members(team_id);

-- Compétitions custom : lookup scores via football_data_match_id
CREATE INDEX IF NOT EXISTS idx_imported_matches_fdid
  ON public.imported_matches(football_data_match_id);
