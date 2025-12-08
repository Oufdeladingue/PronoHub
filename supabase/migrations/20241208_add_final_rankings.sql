-- Migration pour ajouter le stockage du classement final des tournois
-- Permet d'éviter de recalculer le classement à chaque affichage pour les tournois terminés

-- Ajouter la colonne final_rankings à la table tournaments
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS final_rankings JSONB DEFAULT NULL;

-- Commentaire pour documenter la structure
COMMENT ON COLUMN tournaments.final_rankings IS 'Classement final du tournoi stocké à la fin. Structure: [{user_id, username, avatar, rank, total_points, exact_scores, correct_results}]';
