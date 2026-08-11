-- Parrainage tracké par utilisateur (récompense stats sur invitation).
-- Un participant qui rejoint via le lien personnalisé d'un autre joueur mémorise
-- son parrain. Au 2e filleul, le parrain débloque les stats avancées sur CE tournoi
-- (via une ligne tournament_purchases 'stats_access_tournament', gérée par le code).
--
-- Idempotent : réexécutable sans risque.

ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Comptage rapide des filleuls d'un parrain sur un tournoi.
CREATE INDEX IF NOT EXISTS idx_tp_tournament_referred_by
  ON tournament_participants (tournament_id, referred_by);

COMMENT ON COLUMN tournament_participants.referred_by IS
  'Parrain (profiles.id) via le lien d''invitation personnalisé ?ref=. Sert à débloquer les stats au 2e filleul.';
