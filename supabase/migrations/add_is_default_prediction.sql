-- Ajouter la colonne is_default_prediction à la table predictions
-- Cette colonne permet de distinguer les pronostics saisis par l'utilisateur
-- des pronostics créés automatiquement avec le score 0-0

ALTER TABLE public.predictions
ADD COLUMN IF NOT EXISTS is_default_prediction BOOLEAN DEFAULT false;

-- Mettre à jour les pronostics existants avec 0-0 comme étant des pronostics par défaut
UPDATE public.predictions
SET is_default_prediction = true
WHERE predicted_home_score = 0 AND predicted_away_score = 0;

-- Créer un index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_predictions_is_default
ON public.predictions(is_default_prediction);

-- Commentaire pour documentation
COMMENT ON COLUMN public.predictions.is_default_prediction IS
'Indique si le pronostic a été créé automatiquement (true) ou saisi manuellement par l''utilisateur (false)';
