-- ================================================
-- Mise à jour des emojis de réaction
-- Nouveaux emojis: 🔥 🏆 😂 👏 🎯 😢 😡
-- ================================================

-- Supprimer l'ancienne contrainte CHECK
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_emoji_check;

-- Ajouter la nouvelle contrainte CHECK avec les nouveaux emojis
ALTER TABLE message_reactions
ADD CONSTRAINT message_reactions_emoji_check
CHECK (emoji IN ('🔥', '🏆', '😂', '👏', '🎯', '😢', '😡'));

-- Mettre à jour le commentaire
COMMENT ON COLUMN message_reactions.emoji IS 'Emoji de la réaction (🔥 🏆 😂 👏 🎯 😢 😡)';
