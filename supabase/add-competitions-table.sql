-- Table pour stocker les compétitions importées depuis Football-Data
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Table des compétitions
CREATE TABLE IF NOT EXISTS public.competitions (
  id INTEGER PRIMARY KEY, -- ID de Football-Data
  name TEXT NOT NULL,
  code TEXT,
  emblem TEXT, -- URL du logo
  area_name TEXT,
  current_season_start_date DATE,
  current_season_end_date DATE,
  current_matchday INTEGER,
  is_active BOOLEAN DEFAULT true, -- Affichage disponible aux utilisateurs
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour stocker tous les matchs importés
CREATE TABLE IF NOT EXISTS public.imported_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  football_data_match_id INTEGER UNIQUE NOT NULL,
  competition_id INTEGER NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  matchday INTEGER NOT NULL,
  utc_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL, -- 'SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'SUSPENDED', 'CANCELLED'
  home_team_id INTEGER NOT NULL,
  home_team_name TEXT NOT NULL,
  home_team_crest TEXT,
  away_team_id INTEGER NOT NULL,
  away_team_name TEXT NOT NULL,
  away_team_crest TEXT,
  home_score INTEGER,
  away_score INTEGER,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_competitions_imported ON public.competitions(imported_at);
CREATE INDEX IF NOT EXISTS idx_imported_matches_competition ON public.imported_matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_imported_matches_matchday ON public.imported_matches(matchday);
CREATE INDEX IF NOT EXISTS idx_imported_matches_status ON public.imported_matches(status);
CREATE INDEX IF NOT EXISTS idx_imported_matches_date ON public.imported_matches(utc_date);

-- Trigger pour mettre à jour last_updated_at
CREATE OR REPLACE FUNCTION update_last_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_competitions_last_updated
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_at();

CREATE TRIGGER update_imported_matches_last_updated
  BEFORE UPDATE ON public.imported_matches
  FOR EACH ROW EXECUTE FUNCTION update_last_updated_at();

-- Activer RLS
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_matches ENABLE ROW LEVEL SECURITY;

-- Politiques RLS : tout le monde peut lire, seul super_admin peut modifier
CREATE POLICY "Everyone can view competitions"
  ON public.competitions FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage competitions"
  ON public.competitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Everyone can view imported matches"
  ON public.imported_matches FOR SELECT
  USING (true);

CREATE POLICY "Super admins can manage imported matches"
  ON public.imported_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
