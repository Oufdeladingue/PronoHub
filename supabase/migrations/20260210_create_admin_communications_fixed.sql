-- Migration: Système de communication admin
-- Description: Tables pour gérer les communications ponctuelles (emails + push) depuis l'admin

-- Table principale des communications
CREATE TABLE IF NOT EXISTS admin_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Métadonnées
  title VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Planification
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,

  -- Contenu Email
  email_subject VARCHAR(255),
  email_body_html TEXT,
  email_preview_text VARCHAR(255), -- Texte de prévisualisation email

  -- Contenu Notification Push
  notification_title VARCHAR(100),
  notification_body VARCHAR(200),
  notification_image_url TEXT,
  notification_click_url TEXT DEFAULT '/dashboard',

  -- Ciblage (filtres JSON)
  targeting_filters JSONB DEFAULT '{}',

  -- Statistiques
  stats_total_recipients INTEGER DEFAULT 0,
  stats_emails_sent INTEGER DEFAULT 0,
  stats_emails_failed INTEGER DEFAULT 0,
  stats_push_sent INTEGER DEFAULT 0,
  stats_push_failed INTEGER DEFAULT 0
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_admin_communications_status ON admin_communications(status);
CREATE INDEX IF NOT EXISTS idx_admin_communications_scheduled ON admin_communications(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_admin_communications_created_by ON admin_communications(created_by);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_admin_communications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_communications_updated_at
  BEFORE UPDATE ON admin_communications
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_communications_updated_at();

-- Table des logs d'envoi
CREATE TABLE IF NOT EXISTS admin_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES admin_communications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Type d'envoi
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'push')),

  -- Statut
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  error_message TEXT,

  -- Tracking (pour emails Resend)
  resend_message_id TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_comm_logs_communication ON admin_communication_logs(communication_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_user ON admin_communication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_status ON admin_communication_logs(status);
CREATE INDEX IF NOT EXISTS idx_comm_logs_channel ON admin_communication_logs(channel);

-- Table des images uploadées
CREATE TABLE IF NOT EXISTS admin_communication_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES admin_communications(id) ON DELETE CASCADE,

  -- Fichier
  filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Métadonnées
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_comm_images_communication ON admin_communication_images(communication_id);

-- RLS (Row Level Security)
ALTER TABLE admin_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_communication_images ENABLE ROW LEVEL SECURITY;

-- Policies: Seuls les super_admin peuvent accéder
CREATE POLICY "Super admin full access on admin_communications"
  ON admin_communications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access on admin_communication_logs"
  ON admin_communication_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin full access on admin_communication_images"
  ON admin_communication_images
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Fonction helper pour calculer le nombre de destinataires selon les filtres
CREATE OR REPLACE FUNCTION calculate_communication_recipients(filters JSONB)
RETURNS TABLE (user_id UUID, email TEXT, fcm_token TEXT, username TEXT) AS $$
BEGIN
  -- Cette fonction sera complétée avec la logique de ciblage en Phase 2
  -- Pour MVP, on retourne tous les users avec email
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.fcm_token,
    p.username
  FROM profiles p
  WHERE p.email IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commentaires pour documentation
COMMENT ON TABLE admin_communications IS 'Communications ponctuelles envoyées depuis l''admin (emails + notifications push)';
COMMENT ON TABLE admin_communication_logs IS 'Logs détaillés de chaque envoi par utilisateur';
COMMENT ON TABLE admin_communication_images IS 'Images uploadées pour les communications';
COMMENT ON COLUMN admin_communications.targeting_filters IS 'Filtres de ciblage au format JSON (hasActiveTournament, inactiveDays, etc.)';
COMMENT ON COLUMN admin_communications.status IS 'draft: brouillon, scheduled: planifié, sent: envoyé, failed: échec';
