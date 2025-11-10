-- ================================================
-- Table pour tracker les messages lus par les utilisateurs
-- ================================================

-- Créer la table message_read_status
CREATE TABLE IF NOT EXISTS message_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Un seul enregistrement par utilisateur et par tournoi
  CONSTRAINT unique_user_tournament UNIQUE (tournament_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_message_read_status_user_tournament ON message_read_status(user_id, tournament_id);

-- Activer Row Level Security
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- Policy pour lire son propre statut de lecture
CREATE POLICY "Les utilisateurs peuvent lire leur propre statut"
  ON message_read_status
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy pour insérer son propre statut
CREATE POLICY "Les utilisateurs peuvent créer leur statut"
  ON message_read_status
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy pour mettre à jour son propre statut
CREATE POLICY "Les utilisateurs peuvent mettre à jour leur statut"
  ON message_read_status
  FOR UPDATE
  USING (user_id = auth.uid());

-- Commentaires
COMMENT ON TABLE message_read_status IS 'Statut de lecture des messages par utilisateur et tournoi';
COMMENT ON COLUMN message_read_status.tournament_id IS 'ID du tournoi';
COMMENT ON COLUMN message_read_status.user_id IS 'ID de l''utilisateur';
COMMENT ON COLUMN message_read_status.last_read_at IS 'Date et heure de la dernière lecture des messages';
