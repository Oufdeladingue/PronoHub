-- Ajouter le champ bonus_match à la table tournaments

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS bonus_match BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tournaments.bonus_match IS 'Indique si les matchs bonus (double points) sont activés pour ce tournoi';
