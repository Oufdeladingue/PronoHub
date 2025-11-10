-- ================================================
-- Création de la table tournament_messages
-- ================================================
-- Table pour stocker les messages du tchat des tournois
-- ================================================

-- Créer la table tournament_messages
CREATE TABLE IF NOT EXISTS tournament_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Contraintes
  CONSTRAINT message_length CHECK (char_length(message) > 0 AND char_length(message) <= 500)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tournament_messages_tournament_id ON tournament_messages(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_messages_created_at ON tournament_messages(tournament_id, created_at DESC);

-- Activer Row Level Security
ALTER TABLE tournament_messages ENABLE ROW LEVEL SECURITY;

-- Policy pour lire les messages : seuls les participants du tournoi peuvent lire
CREATE POLICY "Les participants peuvent lire les messages du tournoi"
  ON tournament_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournament_participants
      WHERE tournament_participants.tournament_id = tournament_messages.tournament_id
        AND tournament_participants.user_id = auth.uid()
    )
  );

-- Policy pour insérer des messages : seuls les participants peuvent écrire
CREATE POLICY "Les participants peuvent envoyer des messages"
  ON tournament_messages
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM tournament_participants
      WHERE tournament_participants.tournament_id = tournament_messages.tournament_id
        AND tournament_participants.user_id = auth.uid()
    )
  );

-- Policy pour supprimer ses propres messages (optionnel)
CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres messages"
  ON tournament_messages
  FOR DELETE
  USING (user_id = auth.uid());

-- Commentaires
COMMENT ON TABLE tournament_messages IS 'Messages du tchat des tournois';
COMMENT ON COLUMN tournament_messages.tournament_id IS 'ID du tournoi';
COMMENT ON COLUMN tournament_messages.user_id IS 'ID de l''utilisateur qui a envoyé le message';
COMMENT ON COLUMN tournament_messages.message IS 'Contenu du message (max 500 caractères)';
COMMENT ON COLUMN tournament_messages.created_at IS 'Date et heure d''envoi du message';
