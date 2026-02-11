-- Migration: Table des vagues d'envoi pour les communications admin
-- Permet de tracker chaque envoi avec ses filtres de ciblage et stats

CREATE TABLE IF NOT EXISTS admin_communication_waves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES admin_communications(id) ON DELETE CASCADE,

  -- Filtres de ciblage utilisés pour cette vague
  targeting_filters JSONB DEFAULT '{}',

  -- Canaux utilisés
  channels JSONB DEFAULT '{}', -- ex: {"email": true, "push": false}

  -- Utilisateurs exclus manuellement
  excluded_count INTEGER DEFAULT 0,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Statistiques
  stats_total_recipients INTEGER DEFAULT 0,
  stats_emails_sent INTEGER DEFAULT 0,
  stats_emails_failed INTEGER DEFAULT 0,
  stats_push_sent INTEGER DEFAULT 0,
  stats_push_failed INTEGER DEFAULT 0
);

-- Index
CREATE INDEX IF NOT EXISTS idx_comm_waves_communication ON admin_communication_waves(communication_id);
CREATE INDEX IF NOT EXISTS idx_comm_waves_sent_at ON admin_communication_waves(sent_at);

-- RLS
ALTER TABLE admin_communication_waves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access on admin_communication_waves"
  ON admin_communication_waves
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

COMMENT ON TABLE admin_communication_waves IS 'Historique des vagues d''envoi pour chaque communication admin';
