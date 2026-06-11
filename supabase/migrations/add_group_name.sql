-- Ajoute le nom du groupe (poule) pour les compétitions à phases de groupes
-- (Coupe du Monde, Euro, Copa America, etc.)
--
-- football-data.org fournit un champ `group` ("GROUP_A", ...) :
--   - sur chaque match de phase de poule  -> imported_matches.group_name
--   - sur chaque entrée de classement      -> competition_standings.group_name
--
-- À jouer dans l'éditeur SQL Supabase. Idempotent.

ALTER TABLE public.imported_matches
  ADD COLUMN IF NOT EXISTS group_name TEXT;

ALTER TABLE public.competition_standings
  ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Index pour filtrer le classement par groupe rapidement
CREATE INDEX IF NOT EXISTS idx_competition_standings_group
  ON public.competition_standings (competition_id, group_name);
