-- Migration pour ajouter la colonne is_default_prediction
-- Cette colonne permet de différencier les pronostics réels des pronostics par défaut (0-0)

-- 1. Ajouter la colonne is_default_prediction à la table predictions
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS is_default_prediction BOOLEAN DEFAULT FALSE;

-- 2. Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_predictions_is_default
ON predictions(is_default_prediction);

-- 3. Ajouter un commentaire pour la documentation
COMMENT ON COLUMN predictions.is_default_prediction IS 'Indique si ce pronostic est un pronostic par défaut (0-0) non saisi par l''utilisateur. Les pronostics par défaut ne rapportent qu''1 point maximum en cas de match nul.';
