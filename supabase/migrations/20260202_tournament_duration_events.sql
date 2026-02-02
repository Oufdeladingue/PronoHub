-- Table de tracking des événements de modification de durée des tournois
CREATE TABLE IF NOT EXISTS tournament_duration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'recalculation', 'extension_matchdays', 'extension_duration', 'admin_update'
  previous_ending_matchday INT,
  new_ending_matchday INT NOT NULL,
  previous_ending_date TIMESTAMPTZ,
  new_ending_date TIMESTAMPTZ,
  reason TEXT NOT NULL,
  metadata JSONB, -- Pour stocker estimation_used, estimation_details, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_tournament_duration_events_tournament_id
  ON tournament_duration_events(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_duration_events_created_at
  ON tournament_duration_events(created_at DESC);

-- RLS (Row Level Security) - Lecture publique pour transparence
ALTER TABLE tournament_duration_events ENABLE ROW LEVEL SECURITY;

-- Politique de lecture : tout le monde peut voir les événements
CREATE POLICY "Les utilisateurs peuvent voir tous les événements de durée"
  ON tournament_duration_events
  FOR SELECT
  TO authenticated
  USING (true);

-- Politique d'insertion : seulement via service_role (backend)
-- Pas de politique publique d'insertion pour éviter les abus

-- Commentaires pour documentation
COMMENT ON TABLE tournament_duration_events IS 'Historique des modifications de la durée des tournois (ending_date et ending_matchday)';
COMMENT ON COLUMN tournament_duration_events.event_type IS 'Type d''événement: recalculation, extension_matchdays, extension_duration, admin_update';
COMMENT ON COLUMN tournament_duration_events.reason IS 'Raison de la modification (ex: "Extension achetée par utilisateur", "Nouveau match détecté")';
COMMENT ON COLUMN tournament_duration_events.metadata IS 'Données supplémentaires (estimation_used, estimation_details, user_id, etc.)';
