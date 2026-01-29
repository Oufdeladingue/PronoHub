-- Migration: Système de notification pour les modifications de journées custom
-- Date: 2026-01-29

-- Table pour tracker les modifications de matchs sur les journées custom
CREATE TABLE IF NOT EXISTS custom_matchday_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  matchday_id UUID NOT NULL REFERENCES custom_competition_matchdays(id) ON DELETE CASCADE,
  custom_competition_id UUID NOT NULL REFERENCES custom_competitions(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('add', 'remove')),
  -- Infos du match (cachées car le match peut être supprimé)
  match_id UUID, -- Peut être null si supprimé
  football_data_match_id INTEGER,
  cached_home_team TEXT,
  cached_away_team TEXT,
  cached_utc_date TIMESTAMPTZ,
  cached_competition_name TEXT,
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  notified_at TIMESTAMPTZ -- null = pas encore notifié
);

-- Index pour le cron job: trouver les changements non notifiés de plus d'1h
CREATE INDEX idx_custom_matchday_changes_pending
ON custom_matchday_changes(created_at, notified_at)
WHERE notified_at IS NULL;

-- Index pour regrouper par matchday
CREATE INDEX idx_custom_matchday_changes_matchday
ON custom_matchday_changes(matchday_id, created_at);

-- Index pour filtrer par compétition
CREATE INDEX idx_custom_matchday_changes_competition
ON custom_matchday_changes(custom_competition_id);

-- RLS
ALTER TABLE custom_matchday_changes ENABLE ROW LEVEL SECURITY;

-- Policy: les admins peuvent tout faire
CREATE POLICY "Admins can manage matchday changes" ON custom_matchday_changes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Policy: lecture pour les participants des tournois concernés
CREATE POLICY "Participants can view matchday changes" ON custom_matchday_changes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tournaments t
    JOIN tournament_participants tp ON tp.tournament_id = t.id
    WHERE t.custom_competition_id = custom_matchday_changes.custom_competition_id
    AND tp.user_id = auth.uid()
  )
);
