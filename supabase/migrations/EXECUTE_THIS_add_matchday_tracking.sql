-- ================================================
-- MIGRATION: Ajouter le système de tracking des journées
-- ================================================
-- À exécuter dans: Supabase Dashboard > SQL Editor
-- ================================================

-- 1. Ajouter les colonnes de tracking des journées
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS planned_matchdays INTEGER,
ADD COLUMN IF NOT EXISTS actual_matchdays INTEGER,
ADD COLUMN IF NOT EXISTS starting_matchday INTEGER,
ADD COLUMN IF NOT EXISTS ending_matchday INTEGER,
ADD COLUMN IF NOT EXISTS matchday_snapshot JSONB;

-- 2. Ajouter des commentaires
COMMENT ON COLUMN tournaments.planned_matchdays IS 'Nombre de journées/tours prévu à la création du tournoi';
COMMENT ON COLUMN tournaments.actual_matchdays IS 'Nombre réel de journées utilisées après démarrage (peut être < planned si pas assez de journées restantes)';
COMMENT ON COLUMN tournaments.starting_matchday IS 'Numéro de la première journée de compétition utilisée par ce tournoi';
COMMENT ON COLUMN tournaments.ending_matchday IS 'Numéro de la dernière journée de compétition utilisée par ce tournoi';
COMMENT ON COLUMN tournaments.matchday_snapshot IS 'Array JSON des numéros de journées utilisées par le tournoi (ex: [33, 34, 35, 36, 37, 38])';

-- 3. Ajouter des contraintes
ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS check_actual_lte_planned;

ALTER TABLE tournaments
ADD CONSTRAINT check_actual_lte_planned
CHECK (actual_matchdays IS NULL OR planned_matchdays IS NULL OR actual_matchdays <= planned_matchdays);

ALTER TABLE tournaments
DROP CONSTRAINT IF EXISTS check_ending_gte_starting;

ALTER TABLE tournaments
ADD CONSTRAINT check_ending_gte_starting
CHECK (ending_matchday IS NULL OR starting_matchday IS NULL OR ending_matchday >= starting_matchday);

-- 4. Mettre à jour les tournois existants
UPDATE tournaments
SET planned_matchdays = num_matchdays
WHERE planned_matchdays IS NULL AND num_matchdays IS NOT NULL;

-- 5. Vérifier les résultats
SELECT
  name,
  num_matchdays as tours_actuels,
  planned_matchdays as tours_prevus,
  status,
  created_at
FROM tournaments
ORDER BY created_at DESC
LIMIT 5;
