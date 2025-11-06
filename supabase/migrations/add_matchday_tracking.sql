-- Migration: Ajouter le système de tracking des journées pour les tournois
-- Cette migration permet de gérer le décalage entre les journées prévues à la création
-- et les journées réellement disponibles au démarrage du tournoi

-- Ajouter les colonnes de tracking des journées
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS planned_matchdays INTEGER,
ADD COLUMN IF NOT EXISTS actual_matchdays INTEGER,
ADD COLUMN IF NOT EXISTS starting_matchday INTEGER,
ADD COLUMN IF NOT EXISTS ending_matchday INTEGER,
ADD COLUMN IF NOT EXISTS matchday_snapshot JSONB;

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN tournaments.planned_matchdays IS 'Nombre de journées/tours prévu à la création du tournoi';
COMMENT ON COLUMN tournaments.actual_matchdays IS 'Nombre réel de journées utilisées après démarrage (peut être < planned si pas assez de journées restantes)';
COMMENT ON COLUMN tournaments.starting_matchday IS 'Numéro de la première journée de compétition utilisée par ce tournoi';
COMMENT ON COLUMN tournaments.ending_matchday IS 'Numéro de la dernière journée de compétition utilisée par ce tournoi';
COMMENT ON COLUMN tournaments.matchday_snapshot IS 'Array JSON des numéros de journées utilisées par le tournoi (ex: [33, 34, 35, 36, 37, 38])';

-- Ajouter une contrainte pour s'assurer que actual_matchdays <= planned_matchdays
ALTER TABLE tournaments
ADD CONSTRAINT check_actual_lte_planned
CHECK (actual_matchdays IS NULL OR planned_matchdays IS NULL OR actual_matchdays <= planned_matchdays);

-- Ajouter une contrainte pour s'assurer que ending_matchday >= starting_matchday
ALTER TABLE tournaments
ADD CONSTRAINT check_ending_gte_starting
CHECK (ending_matchday IS NULL OR starting_matchday IS NULL OR ending_matchday >= starting_matchday);

-- Mettre à jour les tournois existants avec le nombre de journées prévu
-- (basé sur la colonne number_of_matchdays qui existe déjà)
UPDATE tournaments
SET planned_matchdays = number_of_matchdays
WHERE planned_matchdays IS NULL AND number_of_matchdays IS NOT NULL;
