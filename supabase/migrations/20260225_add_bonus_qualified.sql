-- ============================================
-- Bonus du qualifié : support phases éliminatoires
-- ============================================

-- 1. Table tournaments : toggle bonus qualifié
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS bonus_qualified BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN tournaments.bonus_qualified IS 'Bonus +1 point par bonne prédiction du qualifié en phase éliminatoire';

-- 2. Table imported_matches : scores détaillés + équipe qualifiée
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS home_score_90 INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS away_score_90 INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS home_score_extra INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS away_score_extra INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS home_score_penalty INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS away_score_penalty INTEGER;
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS winner_team_id INTEGER;

COMMENT ON COLUMN imported_matches.home_score_90 IS 'Score domicile à 90 minutes (hors prolongation)';
COMMENT ON COLUMN imported_matches.away_score_90 IS 'Score extérieur à 90 minutes (hors prolongation)';
COMMENT ON COLUMN imported_matches.home_score_extra IS 'Buts en prolongation domicile';
COMMENT ON COLUMN imported_matches.away_score_extra IS 'Buts en prolongation extérieur';
COMMENT ON COLUMN imported_matches.home_score_penalty IS 'Tirs au but domicile';
COMMENT ON COLUMN imported_matches.away_score_penalty IS 'Tirs au but extérieur';
COMMENT ON COLUMN imported_matches.winner_team_id IS 'ID de équipe qualifiée/gagnante (remonté par API)';

-- 3. Table predictions : choix du qualifié par l'utilisateur
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS predicted_qualifier TEXT;
ALTER TABLE predictions ADD CONSTRAINT predictions_predicted_qualifier_check
  CHECK (predicted_qualifier IS NULL OR predicted_qualifier IN ('home', 'away'));

COMMENT ON COLUMN predictions.predicted_qualifier IS 'Prédiction du qualifié : home ou away (optionnel, matchs éliminatoires)';

-- 4. Table matches (dénormalisée par tournoi) : mêmes ajouts
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score_90 INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score_90 INTEGER;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_team_id INTEGER;

-- 5. Index pour les requêtes de matchs avec winner
CREATE INDEX IF NOT EXISTS idx_imported_matches_winner ON imported_matches(winner_team_id) WHERE winner_team_id IS NOT NULL;
