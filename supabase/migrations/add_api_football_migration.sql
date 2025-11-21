-- Migration vers API-Football.com
-- Phase 1: Création des tables de mapping, logs et monitoring

-- ============================================
-- Table 1: Mapping entre football-data.org et api-football.com
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_migration_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  football_data_competition_id INTEGER UNIQUE NOT NULL,
  api_football_league_id INTEGER UNIQUE NOT NULL,
  competition_code TEXT,
  competition_name TEXT,
  country TEXT,
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.api_migration_mapping IS 'Correspondance entre les IDs de football-data.org et api-football.com';
COMMENT ON COLUMN public.api_migration_mapping.football_data_competition_id IS 'ID de la compétition dans football-data.org (ancien système)';
COMMENT ON COLUMN public.api_migration_mapping.api_football_league_id IS 'ID de la league dans api-football.com (nouveau système)';
COMMENT ON COLUMN public.api_migration_mapping.verified IS 'Mapping vérifié manuellement';

-- Index pour optimiser les recherches
CREATE INDEX IF NOT EXISTS idx_api_migration_football_data_id
  ON public.api_migration_mapping(football_data_competition_id);

CREATE INDEX IF NOT EXISTS idx_api_migration_api_football_id
  ON public.api_migration_mapping(api_football_league_id);

-- ============================================
-- Table 2: Logs des requêtes API pour monitoring du quota
-- ============================================
CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_date DATE NOT NULL,
  endpoint TEXT NOT NULL,
  competition_id INTEGER,
  method TEXT DEFAULT 'GET',
  status_code INTEGER,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.api_request_logs IS 'Logs de toutes les requêtes vers api-football.com pour monitoring du quota quotidien';
COMMENT ON COLUMN public.api_request_logs.request_date IS 'Date de la requête (utilisé pour compteur quotidien)';
COMMENT ON COLUMN public.api_request_logs.endpoint IS 'Endpoint appelé (ex: /fixtures, /leagues)';
COMMENT ON COLUMN public.api_request_logs.competition_id IS 'ID de la compétition concernée (si applicable)';

-- Index pour optimiser les requêtes de monitoring
CREATE INDEX IF NOT EXISTS idx_api_request_logs_date
  ON public.api_request_logs(request_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_competition
  ON public.api_request_logs(competition_id, request_date DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_success
  ON public.api_request_logs(success, request_date DESC);

-- ============================================
-- Vue: Usage quotidien de l'API
-- ============================================
CREATE OR REPLACE VIEW public.daily_api_usage AS
SELECT
  request_date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
  100 - COUNT(*) as remaining_requests,
  ROUND((COUNT(*) * 100.0 / 100), 2) as usage_percentage,
  CASE
    WHEN COUNT(*) >= 100 THEN 'EXHAUSTED'
    WHEN COUNT(*) >= 80 THEN 'CRITICAL'
    WHEN COUNT(*) >= 60 THEN 'WARNING'
    ELSE 'NORMAL'
  END as quota_status,
  MIN(created_at) as first_request_at,
  MAX(created_at) as last_request_at,
  ROUND(AVG(response_time_ms), 0) as avg_response_time_ms
FROM public.api_request_logs
GROUP BY request_date
ORDER BY request_date DESC;

COMMENT ON VIEW public.daily_api_usage IS 'Vue consolidée de l''utilisation quotidienne de l''API (quota de 100 req/jour)';

-- ============================================
-- Vue: Usage du jour en cours
-- ============================================
CREATE OR REPLACE VIEW public.current_day_api_usage AS
SELECT
  CURRENT_DATE as request_date,
  COUNT(*) as total_requests,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful_requests,
  SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed_requests,
  100 - COUNT(*) as remaining_requests,
  ROUND((COUNT(*) * 100.0 / 100), 2) as usage_percentage,
  CASE
    WHEN COUNT(*) >= 100 THEN 'EXHAUSTED'
    WHEN COUNT(*) >= 80 THEN 'CRITICAL'
    WHEN COUNT(*) >= 60 THEN 'WARNING'
    ELSE 'NORMAL'
  END as quota_status,
  MIN(created_at) as first_request_at,
  MAX(created_at) as last_request_at,
  ROUND(AVG(response_time_ms), 0) as avg_response_time_ms
FROM public.api_request_logs
WHERE request_date = CURRENT_DATE;

COMMENT ON VIEW public.current_day_api_usage IS 'Utilisation de l''API pour la journée en cours uniquement';

-- ============================================
-- Table 3: Ajout colonnes de transition dans competitions
-- ============================================
ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS legacy_football_data_id INTEGER;

ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS api_provider VARCHAR(50) DEFAULT 'football-data';

COMMENT ON COLUMN public.competitions.legacy_football_data_id IS 'Ancien ID de football-data.org (pour traçabilité)';
COMMENT ON COLUMN public.competitions.api_provider IS 'Provider actuel: football-data ou api-football';

-- Index pour recherche par ancien ID
CREATE INDEX IF NOT EXISTS idx_competitions_legacy_id
  ON public.competitions(legacy_football_data_id);

CREATE INDEX IF NOT EXISTS idx_competitions_provider
  ON public.competitions(api_provider);

-- ============================================
-- Données initiales: Mapping des compétitions principales
-- ============================================
INSERT INTO public.api_migration_mapping
  (football_data_competition_id, api_football_league_id, competition_code, competition_name, country, verified, notes)
VALUES
  -- Top 5 Leagues Européennes
  (2021, 39, 'PL', 'Premier League', 'England', true, 'Angleterre - Division 1'),
  (2014, 61, 'FL1', 'Ligue 1', 'France', true, 'France - Division 1'),
  (2019, 135, 'SA', 'Serie A', 'Italy', true, 'Italie - Division 1'),
  (2002, 78, 'BL1', 'Bundesliga', 'Germany', true, 'Allemagne - Division 1'),
  (2015, 140, 'PD', 'La Liga', 'Spain', true, 'Espagne - Division 1'),

  -- Compétitions Européennes
  (2001, 2, 'CL', 'UEFA Champions League', 'Europe', true, 'Ligue des Champions'),
  (2146, 3, 'EL', 'UEFA Europa League', 'Europe', true, 'Europa League'),
  (2017, 848, 'ECL', 'UEFA Europa Conference League', 'Europe', true, 'Conference League'),

  -- Autres Ligues Majeures
  (2003, 94, 'DED', 'Eredivisie', 'Netherlands', true, 'Pays-Bas - Division 1'),
  (2017, 94, 'PPL', 'Primeira Liga', 'Portugal', true, 'Portugal - Division 1'),
  (2016, 88, 'Championship', 'Championship', 'England', true, 'Angleterre - Division 2'),
  (2015, 61, 'FL2', 'Ligue 2', 'France', true, 'France - Division 2'),

  -- Compétitions Internationales
  (2018, 1, 'WC', 'World Cup', 'World', true, 'Coupe du Monde FIFA'),
  (2000, 4, 'EC', 'European Championship', 'Europe', true, 'Euro - Championnat d''Europe')

ON CONFLICT (football_data_competition_id) DO NOTHING;

-- ============================================
-- Fonction: Obtenir l'ID API-Football depuis football-data ID
-- ============================================
CREATE OR REPLACE FUNCTION public.get_api_football_id(fd_competition_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  af_id INTEGER;
BEGIN
  SELECT api_football_league_id INTO af_id
  FROM public.api_migration_mapping
  WHERE football_data_competition_id = fd_competition_id;

  RETURN af_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_api_football_id IS 'Convertit un ID football-data.org vers api-football.com';

-- ============================================
-- Fonction: Obtenir l'ID football-data depuis API-Football ID
-- ============================================
CREATE OR REPLACE FUNCTION public.get_football_data_id(af_league_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  fd_id INTEGER;
BEGIN
  SELECT football_data_competition_id INTO fd_id
  FROM public.api_migration_mapping
  WHERE api_football_league_id = af_league_id;

  RETURN fd_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.get_football_data_id IS 'Convertit un ID api-football.com vers football-data.org';

-- ============================================
-- Trigger: Mise à jour automatique de updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_api_migration_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_migration_mapping_timestamp
  BEFORE UPDATE ON public.api_migration_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_api_migration_mapping_updated_at();

-- ============================================
-- Permissions RLS (Row Level Security)
-- ============================================

-- Enable RLS sur les nouvelles tables
ALTER TABLE public.api_migration_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Lecture publique pour le mapping (données non sensibles)
CREATE POLICY "mapping_select_public" ON public.api_migration_mapping
  FOR SELECT USING (true);

-- Policy: Seuls les admins peuvent modifier le mapping
CREATE POLICY "mapping_admin_all" ON public.api_migration_mapping
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Seuls les admins peuvent lire les logs
CREATE POLICY "logs_admin_select" ON public.api_request_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Policy: Système peut insérer des logs (via service_role)
CREATE POLICY "logs_system_insert" ON public.api_request_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- Grants pour service_role
-- ============================================
GRANT ALL ON public.api_migration_mapping TO service_role;
GRANT ALL ON public.api_request_logs TO service_role;
GRANT SELECT ON public.daily_api_usage TO service_role;
GRANT SELECT ON public.current_day_api_usage TO service_role;

-- ============================================
-- Affichage du résumé de migration
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration API-Football - Phase 1 complétée';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables créées:';
  RAISE NOTICE '  - api_migration_mapping (% lignes)', (SELECT COUNT(*) FROM public.api_migration_mapping);
  RAISE NOTICE '  - api_request_logs';
  RAISE NOTICE 'Vues créées:';
  RAISE NOTICE '  - daily_api_usage';
  RAISE NOTICE '  - current_day_api_usage';
  RAISE NOTICE 'Fonctions créées:';
  RAISE NOTICE '  - get_api_football_id()';
  RAISE NOTICE '  - get_football_data_id()';
  RAISE NOTICE '========================================';
END $$;
