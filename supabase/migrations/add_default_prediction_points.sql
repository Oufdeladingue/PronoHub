-- Ajouter une colonne pour stocker les points attribuables avec un pronostic par défaut (0-0)
-- Un prono par défaut = un prono NON renseigné dans les délais par l'utilisateur, qui devient automatiquement 0-0
-- Cette valeur est définie lors de la création du tournoi par le capitaine

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS scoring_default_prediction_max INTEGER DEFAULT 1;

-- Ajouter un commentaire pour expliquer la colonne
COMMENT ON COLUMN tournaments.scoring_default_prediction_max IS 'Nombre de points pouvant être attribués en cas de bon résultat ou score exact avec un pronostic NON renseigné dans les délais (donc 0-0 par défaut)';
