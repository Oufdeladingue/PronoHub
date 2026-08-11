-- Parrainage tracké par utilisateur (récompense stats sur invitation).
-- Un participant qui rejoint via le lien personnalisé d'un autre joueur mémorise
-- son parrain. Au 2e filleul, le parrain débloque les stats avancées sur CE tournoi
-- (via une ligne tournament_purchases 'stats_access_tournament', gérée par le code).
--
-- ⚠️ IMPORTANT : referred_by est un uuid SIMPLE, SANS foreign key vers profiles.
-- Un 2e FK vers profiles rendrait ambigus tous les embeds `profiles(...)` sur
-- tournament_participants (erreur PostgREST "more than one relationship") → casse
-- le classement et d'autres endpoints. On garde donc la colonne sans contrainte FK.
--
-- Idempotent : réexécutable sans risque.

-- Colonne (uuid simple, pas de REFERENCES).
ALTER TABLE tournament_participants
  ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Retire le FK s'il a été créé par une version précédente de cette migration.
ALTER TABLE tournament_participants
  DROP CONSTRAINT IF EXISTS tournament_participants_referred_by_fkey;

-- Comptage rapide des filleuls d'un parrain sur un tournoi.
CREATE INDEX IF NOT EXISTS idx_tp_tournament_referred_by
  ON tournament_participants (tournament_id, referred_by);

COMMENT ON COLUMN tournament_participants.referred_by IS
  'Parrain (profiles.id) via le lien d''invitation personnalisé ?ref=. uuid simple (pas de FK, pour ne pas ambiguïser les embeds profiles). Débloque les stats au 2e filleul.';
