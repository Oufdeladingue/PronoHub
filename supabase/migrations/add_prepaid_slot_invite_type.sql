-- Migration: Ajouter 'prepaid_slot' aux valeurs autorisées pour invite_type
-- Cette migration modifie la contrainte check pour supporter les places prépayées Platinium

-- Supprimer l'ancienne contrainte
ALTER TABLE public.tournament_participants
DROP CONSTRAINT IF EXISTS tournament_participants_invite_type_check;

-- Créer la nouvelle contrainte avec 'prepaid_slot' inclus
ALTER TABLE public.tournament_participants
ADD CONSTRAINT tournament_participants_invite_type_check
CHECK (invite_type IN ('free', 'paid_slot', 'premium_invite', 'prepaid_slot'));

-- Commentaire explicatif
COMMENT ON COLUMN public.tournament_participants.invite_type IS
'Type d''invitation: free (gratuit), paid_slot (slot payant), premium_invite (invitation premium), prepaid_slot (place prépayée par le créateur pour Platinium)';
