-- ================================================
-- Ajout des réactions et réponses au chat
-- ================================================
-- 1. Table message_reactions pour les emojis
-- 2. Colonne reply_to_id pour les réponses
-- ================================================

-- ================================================
-- 1. Créer la table message_reactions
-- ================================================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES tournament_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🎉')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Un utilisateur ne peut mettre qu'une fois le même emoji sur un message
  UNIQUE(message_id, user_id, emoji)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- Activer Row Level Security
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: les participants du tournoi peuvent voir les réactions
CREATE POLICY "select_reactions" ON message_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournament_messages tm
      JOIN tournament_participants tp ON tm.tournament_id = tp.tournament_id
      WHERE tm.id = message_reactions.message_id
        AND tp.user_id = auth.uid()
    )
  );

-- Policy INSERT: les participants peuvent ajouter des réactions
CREATE POLICY "insert_reactions" ON message_reactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM tournament_messages tm
      JOIN tournament_participants tp ON tm.tournament_id = tp.tournament_id
      WHERE tm.id = message_reactions.message_id
        AND tp.user_id = auth.uid()
    )
  );

-- Policy DELETE: les utilisateurs peuvent retirer leurs propres réactions
CREATE POLICY "delete_reactions" ON message_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Commentaires
COMMENT ON TABLE message_reactions IS 'Réactions emoji sur les messages du chat';
COMMENT ON COLUMN message_reactions.message_id IS 'ID du message auquel la réaction est liée';
COMMENT ON COLUMN message_reactions.user_id IS 'ID de l''utilisateur qui a réagi';
COMMENT ON COLUMN message_reactions.emoji IS 'Emoji de la réaction (👍 ❤️ 😂 😮 😢 🎉)';

-- ================================================
-- 2. Ajouter la colonne reply_to_id à tournament_messages
-- ================================================
ALTER TABLE tournament_messages
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES tournament_messages(id) ON DELETE SET NULL;

-- Index pour les requêtes de threads/réponses
CREATE INDEX IF NOT EXISTS idx_tournament_messages_reply_to ON tournament_messages(reply_to_id);

-- Commentaire
COMMENT ON COLUMN tournament_messages.reply_to_id IS 'ID du message auquel celui-ci répond (null si pas une réponse)';
