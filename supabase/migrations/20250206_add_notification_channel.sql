-- Migration: Ajouter le champ channel pour dissocier email et push notifications
-- Permet d'éviter les doublons quand l'utilisateur a l'app Android

-- 1. Ajouter la colonne channel
ALTER TABLE notification_logs
ADD COLUMN IF NOT EXISTS channel VARCHAR(10) DEFAULT 'email'
CHECK (channel IN ('email', 'push'));

-- 2. Supprimer l'ancienne contrainte d'unicité
ALTER TABLE notification_logs
DROP CONSTRAINT IF EXISTS notification_logs_user_id_notification_type_tournament_id_m_key;

-- 3. Créer la nouvelle contrainte d'unicité incluant le channel
-- Cela permet d'avoir un log email ET un log push pour le même événement si nécessaire
ALTER TABLE notification_logs
ADD CONSTRAINT notification_logs_unique_per_channel
UNIQUE(user_id, notification_type, tournament_id, matchday, match_id, channel);

-- 4. Index pour les requêtes par channel
CREATE INDEX IF NOT EXISTS idx_notification_logs_channel ON notification_logs(channel);

-- 5. Commentaire pour documentation
COMMENT ON COLUMN notification_logs.channel IS 'Canal de notification: email ou push. Permet de tracker séparément les envois.';
