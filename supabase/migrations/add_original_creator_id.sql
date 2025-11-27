-- Migration: Ajouter original_creator_id à la table tournaments
-- Date: 2025-11-27
-- Description: Cette colonne garde en mémoire l'utilisateur qui a initialement créé le tournoi
-- et "consommé" le slot. Cela empêche les utilisateurs de créer des tournois à l'infini
-- en transférant le capitanat à d'autres participants puis en quittant le tournoi.
--
-- creator_id = capitaine actuel (peut changer avec le transfert)
-- original_creator_id = créateur original (ne change jamais, compte pour les quotas)

-- Ajouter la colonne original_creator_id
ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS original_creator_id UUID REFERENCES profiles(id);

-- Remplir original_creator_id pour les tournois existants (copier creator_id)
UPDATE tournaments
SET original_creator_id = creator_id
WHERE original_creator_id IS NULL;

-- Ajouter un index pour améliorer les performances des requêtes de quotas
CREATE INDEX IF NOT EXISTS idx_tournaments_original_creator_id
ON tournaments(original_creator_id);

-- Index composé pour les requêtes de quotas par type
CREATE INDEX IF NOT EXISTS idx_tournaments_original_creator_type_status
ON tournaments(original_creator_id, tournament_type, status);

-- Commentaire explicatif
COMMENT ON COLUMN tournaments.original_creator_id IS
'ID de l''utilisateur qui a créé le tournoi. Ne change jamais, même après transfert de capitanat. Utilisé pour compter les quotas de création.';
