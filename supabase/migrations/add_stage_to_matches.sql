-- Migration: Ajouter la colonne 'stage' à la table matches
-- Cette colonne permettra de distinguer les phases de compétition
-- (phase de poule, barrages, phases à élimination, etc.)

-- Ajouter la colonne stage (optionnelle, NULL par défaut pour les championnats classiques)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS stage TEXT;

-- Créer un index pour améliorer les performances de recherche par stage
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches(stage);

-- Créer un index composé pour rechercher par tournoi + stage
CREATE INDEX IF NOT EXISTS idx_matches_tournament_stage ON matches(tournament_id, stage);

-- Commentaire sur la colonne
COMMENT ON COLUMN matches.stage IS 'Phase de la compétition (ex: LEAGUE_STAGE, PLAYOFFS, QUARTER_FINALS, SEMI_FINALS, FINAL). NULL pour les championnats classiques.';

-- Exemples de valeurs possibles pour stage:
-- NULL: Championnat classique avec uniquement des journées
-- 'LEAGUE_STAGE': Phase de poule
-- 'PLAYOFFS': Barrages
-- 'LAST_16': Huitièmes de finale
-- 'QUARTER_FINALS': Quarts de finale
-- 'SEMI_FINALS': Demi-finales
-- 'FINAL': Finale
