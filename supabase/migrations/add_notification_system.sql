-- Migration: Système de notifications email
-- Date: 2024-11-27

-- Table des préférences de notifications utilisateur
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rappels de pronostics
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_hours_before INTEGER DEFAULT 4, -- Heures avant le match pour envoyer le rappel

  -- Récaps de journée
  matchday_recap_enabled BOOLEAN DEFAULT true,

  -- Notifications de tournoi
  tournament_started_enabled BOOLEAN DEFAULT true,
  tournament_ended_enabled BOOLEAN DEFAULT true,

  -- Notifications sociales
  new_participant_enabled BOOLEAN DEFAULT false, -- Quand quelqu'un rejoint un tournoi
  captain_transfer_enabled BOOLEAN DEFAULT true,

  -- Plages horaires autorisées (pour ne pas déranger la nuit)
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Table des logs de notifications (pour éviter les doublons et avoir un historique)
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type de notification
  notification_type VARCHAR(50) NOT NULL, -- 'reminder', 'matchday_recap', 'tournament_started', etc.

  -- Contexte (pour éviter les doublons)
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  matchday INTEGER,
  match_id UUID, -- Pour les rappels de match spécifique

  -- Statut
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
  error_message TEXT,

  -- Timestamps
  scheduled_at TIMESTAMPTZ, -- Quand la notification doit être envoyée
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Index unique pour éviter les doublons
  UNIQUE(user_id, notification_type, tournament_id, matchday, match_id)
);

-- Index pour les requêtes courantes
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_type ON notification_logs(user_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tournament ON notification_logs(tournament_id);

-- Fonction pour créer les préférences par défaut lors de l'inscription
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer les préférences automatiquement
DROP TRIGGER IF EXISTS on_user_created_notification_prefs ON auth.users;
CREATE TRIGGER on_user_created_notification_prefs
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_preferences();

-- Créer les préférences pour les utilisateurs existants
INSERT INTO user_notification_preferences (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- RLS Policies
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Utilisateurs peuvent voir et modifier leurs propres préférences
CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own notification logs"
  ON notification_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role peut tout faire (pour le CRON)
CREATE POLICY "Service role full access to notification_preferences"
  ON user_notification_preferences FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to notification_logs"
  ON notification_logs FOR ALL
  USING (auth.role() = 'service_role');
