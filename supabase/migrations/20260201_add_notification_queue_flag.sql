-- Migration: Système de flag pour éviter les exécutions de cron inutiles
-- Date: 2026-02-01
-- Objectif: Réduire les coûts Vercel en ne traitant que les changements réels

-- Table pour tracker s'il y a des changements en attente de notification
CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  has_pending_custom_changes BOOLEAN DEFAULT FALSE,
  last_check_custom_changes TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer une ligne unique (singleton pattern)
INSERT INTO notification_queue (id, has_pending_custom_changes)
VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Fonction: Marquer qu'il y a des changements custom en attente
CREATE OR REPLACE FUNCTION mark_pending_custom_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour le flag seulement si le changement n'est pas encore notifié
  UPDATE notification_queue
  SET
    has_pending_custom_changes = TRUE,
    updated_at = NOW()
  WHERE id = 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Activer le flag quand un nouveau changement est inséré
DROP TRIGGER IF EXISTS on_custom_matchday_change_inserted ON custom_matchday_changes;
CREATE TRIGGER on_custom_matchday_change_inserted
AFTER INSERT ON custom_matchday_changes
FOR EACH ROW
EXECUTE FUNCTION mark_pending_custom_changes();

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_flags
ON notification_queue(has_pending_custom_changes, last_check_custom_changes);

-- RLS: Seul le service role peut modifier
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage notification queue" ON notification_queue
FOR ALL USING (
  auth.jwt()->>'role' = 'service_role'
);

-- Policy lecture pour authenticated users (pour debug)
CREATE POLICY "Authenticated users can view notification queue" ON notification_queue
FOR SELECT USING (auth.role() = 'authenticated');

-- Commentaires
COMMENT ON TABLE notification_queue IS 'Singleton table pour tracker les changements en attente de notification (évite exécutions cron inutiles)';
COMMENT ON COLUMN notification_queue.has_pending_custom_changes IS 'TRUE si des changements custom sont en attente de notification';
COMMENT ON COLUMN notification_queue.last_check_custom_changes IS 'Timestamp du dernier check du cron notify-custom-changes';
