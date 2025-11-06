-- Migration: Ajouter la colonne total_matchdays à la table competitions
-- Cette colonne stocke le nombre total de journées d'une compétition

ALTER TABLE competitions
ADD COLUMN IF NOT EXISTS total_matchdays INTEGER;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN competitions.total_matchdays IS 'Nombre total de journées dans la saison de la compétition (calculé à partir du max des matchday des matchs)';
