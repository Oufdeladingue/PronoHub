-- ================================================
-- Migration: Configuration manuelle des compétitions
-- ================================================
-- Pour les compétitions à élimination directe où le nombre
-- total de journées n'est pas déterminable automatiquement
-- ================================================

-- Créer une table de configuration pour les compétitions spéciales
CREATE TABLE IF NOT EXISTS competition_config (
  competition_id INTEGER PRIMARY KEY REFERENCES competitions(id),
  total_matchdays_override INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE competition_config IS 'Configuration manuelle pour les compétitions avec phases à élimination';
COMMENT ON COLUMN competition_config.total_matchdays_override IS 'Nombre total de journées prévu (y compris phases futures)';

-- Insérer les configurations pour les compétitions connues (uniquement si elles existent)

-- UEFA Champions League (2001)
-- Phase de ligue: 8 journées (nouveau format 2024/25)
-- Barrages: 2 journées (aller-retour)
-- 8èmes de finale: 2 journées
-- Quarts de finale: 2 journées
-- Demi-finales: 2 journées
-- Finale: 1 journée
-- Total: 17 journées
INSERT INTO competition_config (competition_id, total_matchdays_override, notes)
SELECT 2001, 17, 'Nouveau format Champions League 2024/25: Phase de ligue (8) + Barrages (2) + 8èmes (2) + Quarts (2) + Demis (2) + Finale (1)'
WHERE EXISTS (SELECT 1 FROM competitions WHERE id = 2001)
ON CONFLICT (competition_id) DO UPDATE SET
  total_matchdays_override = EXCLUDED.total_matchdays_override,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- UEFA Europa League (2146)
-- Format similaire avec phase de ligue puis élimination
INSERT INTO competition_config (competition_id, total_matchdays_override, notes)
SELECT 2146, 15, 'Europa League: Phase de ligue (8) + Barrages (2) + 8èmes (2) + Quarts (2) + Demis (2) + Finale (1)'
WHERE EXISTS (SELECT 1 FROM competitions WHERE id = 2146)
ON CONFLICT (competition_id) DO UPDATE SET
  total_matchdays_override = EXCLUDED.total_matchdays_override,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- Mettre à jour la table competitions avec les valeurs de config
UPDATE competitions c
SET total_matchdays = cc.total_matchdays_override
FROM competition_config cc
WHERE c.id = cc.competition_id;

-- Vérification
SELECT
  c.id,
  c.name,
  c.code,
  c.current_matchday,
  c.total_matchdays,
  cc.notes
FROM competitions c
LEFT JOIN competition_config cc ON c.id = cc.competition_id
WHERE cc.competition_id IS NOT NULL
ORDER BY c.name;
