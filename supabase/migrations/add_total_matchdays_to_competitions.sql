-- ================================================
-- Migration: Ajouter total_matchdays à competitions
-- ================================================
-- Cette colonne est nécessaire pour le système d'ajustement
-- des journées lors du démarrage des tournois
-- ================================================

-- Ajouter la colonne total_matchdays si elle n'existe pas
ALTER TABLE competitions
ADD COLUMN IF NOT EXISTS total_matchdays INTEGER;

-- Créer un commentaire pour documenter la colonne
COMMENT ON COLUMN competitions.total_matchdays IS 'Nombre total de journées dans la compétition (ex: 38 pour Ligue 1)';

-- Mettre à jour les compétitions existantes avec des valeurs par défaut
-- basées sur les compétitions européennes standards

-- Ligue 1 (France) - 38 journées
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'FL1' AND total_matchdays IS NULL;

-- Premier League (Angleterre) - 38 journées
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'PL' AND total_matchdays IS NULL;

-- La Liga (Espagne) - 38 journées
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'PD' AND total_matchdays IS NULL;

-- Serie A (Italie) - 38 journées
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'SA' AND total_matchdays IS NULL;

-- Bundesliga (Allemagne) - 34 journées
UPDATE competitions
SET total_matchdays = 34
WHERE code = 'BL1' AND total_matchdays IS NULL;

-- Ligue des Champions - 38 journées (phase de ligue + knockouts)
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'CL' AND total_matchdays IS NULL;

-- Championnat du Brésil - 38 journées
UPDATE competitions
SET total_matchdays = 38
WHERE code = 'BSA' AND total_matchdays IS NULL;

-- Pour toutes les autres compétitions sans valeur, mettre 38 par défaut
UPDATE competitions
SET total_matchdays = 38
WHERE total_matchdays IS NULL;

-- Vérification des données
SELECT
  id,
  name,
  code,
  current_matchday,
  total_matchdays,
  (total_matchdays - current_matchday) as journees_restantes
FROM competitions
ORDER BY name;
