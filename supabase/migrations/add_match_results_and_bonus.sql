-- Migration pour ajouter le support des résultats de matchs et des matchs bonus
-- Note: home_score et away_score existent déjà dans imported_matches

-- 1. Ajouter la colonne finished à imported_matches si elle n'existe pas
ALTER TABLE imported_matches
ADD COLUMN IF NOT EXISTS finished BOOLEAN DEFAULT FALSE;

-- 2. Créer un index sur finished pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_imported_matches_finished
ON imported_matches(finished);

-- 3. Créer un index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_imported_matches_competition_matchday_finished
ON imported_matches(competition_id, matchday, finished);

-- 4. Créer la table tournament_bonus_matches
CREATE TABLE IF NOT EXISTS tournament_bonus_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  match_id UUID NOT NULL REFERENCES imported_matches(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, matchday)
);

-- 5. Créer des index pour tournament_bonus_matches
CREATE INDEX IF NOT EXISTS idx_tournament_bonus_matches_tournament
ON tournament_bonus_matches(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_bonus_matches_match
ON tournament_bonus_matches(match_id);

-- 6. Ajouter des commentaires pour la documentation
COMMENT ON TABLE tournament_bonus_matches IS 'Stocke les matchs bonus (points x2) pour chaque journée de chaque tournoi';
COMMENT ON COLUMN tournament_bonus_matches.tournament_id IS 'ID du tournoi';
COMMENT ON COLUMN tournament_bonus_matches.matchday IS 'Numéro de la journée';
COMMENT ON COLUMN tournament_bonus_matches.match_id IS 'ID du match bonus sélectionné';

COMMENT ON COLUMN imported_matches.finished IS 'Indique si le match est terminé et que les scores finaux sont disponibles';
