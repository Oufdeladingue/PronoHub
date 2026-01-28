-- Migration: Add Competition Standings Table
-- Date: 2026-01-28
-- Description: Stores league standings for each competition to display team positions in stats modal

-- Table pour stocker les classements des compétitions
CREATE TABLE IF NOT EXISTS public.competition_standings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id INTEGER NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL,
  team_name TEXT NOT NULL,
  team_crest TEXT,
  position INTEGER NOT NULL,
  played_games INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  draw INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  goals_for INTEGER DEFAULT 0,
  goals_against INTEGER DEFAULT 0,
  goal_difference INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  form TEXT, -- Derniers résultats (ex: "WWDLW")
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte d'unicité: une seule entrée par équipe par compétition
  UNIQUE(competition_id, team_id)
);

-- Index pour recherche rapide par compétition
CREATE INDEX IF NOT EXISTS idx_competition_standings_competition
ON public.competition_standings(competition_id);

-- Index pour recherche par équipe
CREATE INDEX IF NOT EXISTS idx_competition_standings_team
ON public.competition_standings(competition_id, team_id);

-- Index pour tri par position
CREATE INDEX IF NOT EXISTS idx_competition_standings_position
ON public.competition_standings(competition_id, position);

-- RLS: lecture publique (les classements sont des données publiques)
ALTER TABLE public.competition_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for standings"
  ON public.competition_standings FOR SELECT
  USING (true);

-- Commentaire pour documentation
COMMENT ON TABLE public.competition_standings IS 'Classements des compétitions, mis à jour quotidiennement via sync-standings';
