-- ============================================
-- Migration: Setup pg_cron pour les mises à jour automatiques
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- NOTE: pg_cron et pg_net sont déjà activés par Supabase Pro
-- Pas besoin de CREATE EXTENSION ni de GRANT sur le schema cron

-- 1. Table pour stocker les logs des exécutions cron
CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  message TEXT,
  competitions_updated INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes récentes
CREATE INDEX IF NOT EXISTS idx_cron_logs_created_at ON cron_logs(created_at DESC);

-- Activer RLS mais permettre l'accès
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre aux admins de lire les logs
CREATE POLICY "Allow authenticated to read cron_logs" ON cron_logs
  FOR SELECT TO authenticated USING (true);

-- Policy pour permettre l'insertion (depuis les fonctions)
CREATE POLICY "Allow insert to cron_logs" ON cron_logs
  FOR INSERT TO authenticated, service_role WITH CHECK (true);

-- 2. Fonction pour appeler l'API de mise à jour
-- Cette fonction sera appelée par pg_cron
CREATE OR REPLACE FUNCTION call_update_matches_api()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  app_url TEXT;
  cron_secret TEXT;
  response_status INTEGER;
  response_body JSONB;
  start_time TIMESTAMPTZ;
  auto_update_enabled BOOLEAN;
BEGIN
  start_time := NOW();

  -- Vérifier si les MAJ auto sont activées
  SELECT (setting_value = 'true') INTO auto_update_enabled
  FROM admin_settings
  WHERE setting_key = 'cron_auto_update_enabled';

  IF NOT COALESCE(auto_update_enabled, false) THEN
    INSERT INTO cron_logs (job_name, status, message)
    VALUES ('update-matches', 'skipped', 'Auto-update is disabled');
    RETURN;
  END IF;

  -- Récupérer l'URL de l'app depuis les settings ou utiliser la valeur par défaut
  SELECT setting_value INTO app_url
  FROM admin_settings
  WHERE setting_key = 'app_url';

  -- URL de production de l'app
  app_url := COALESCE(app_url, 'https://prono-hub.vercel.app');

  -- Récupérer le secret cron
  SELECT setting_value INTO cron_secret
  FROM admin_settings
  WHERE setting_key = 'cron_secret';

  -- Appeler l'API via pg_net
  SELECT status, content::jsonb INTO response_status, response_body
  FROM net.http_post(
    url := app_url || '/api/football/auto-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
    ),
    body := '{}'::jsonb
  );

  -- Logger le résultat
  IF response_status = 200 THEN
    INSERT INTO cron_logs (job_name, status, message, competitions_updated, execution_time_ms)
    VALUES (
      'update-matches',
      'success',
      response_body->>'message',
      COALESCE((response_body->>'successCount')::integer, 0),
      EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer
    );

    -- Mettre à jour la date de dernière exécution
    INSERT INTO admin_settings (setting_key, setting_value)
    VALUES ('cron_last_run', NOW()::text)
    ON CONFLICT (setting_key) DO UPDATE SET setting_value = NOW()::text;
  ELSE
    INSERT INTO cron_logs (job_name, status, message, execution_time_ms)
    VALUES (
      'update-matches',
      'error',
      'HTTP ' || response_status || ': ' || COALESCE(response_body->>'error', 'Unknown error'),
      EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_logs (job_name, status, message)
  VALUES ('update-matches', 'error', SQLERRM);
END;
$$;

-- 3. Fonction pour créer/modifier le job cron
CREATE OR REPLACE FUNCTION manage_update_cron(
  p_enabled BOOLEAN,
  p_schedule TEXT DEFAULT '0 18-23 * * *'  -- Par défaut: toutes les heures de 18h à 23h
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_exists BOOLEAN;
  result TEXT;
BEGIN
  -- Vérifier si le job existe
  SELECT EXISTS(
    SELECT 1 FROM cron.job WHERE jobname = 'update-matches'
  ) INTO job_exists;

  IF p_enabled THEN
    IF job_exists THEN
      -- Mettre à jour le schedule
      PERFORM cron.alter_job(
        job_id := (SELECT jobid FROM cron.job WHERE jobname = 'update-matches'),
        schedule := p_schedule
      );
      result := 'Job updated with schedule: ' || p_schedule;
    ELSE
      -- Créer le job
      PERFORM cron.schedule(
        'update-matches',
        p_schedule,
        'SELECT call_update_matches_api();'
      );
      result := 'Job created with schedule: ' || p_schedule;
    END IF;
  ELSE
    IF job_exists THEN
      -- Supprimer le job
      PERFORM cron.unschedule('update-matches');
      result := 'Job disabled and removed';
    ELSE
      result := 'Job was already disabled';
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- 4. Fonction pour obtenir le statut du cron
CREATE OR REPLACE FUNCTION get_cron_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  job_record RECORD;
  last_log RECORD;
BEGIN
  -- Récupérer les infos du job
  SELECT * INTO job_record
  FROM cron.job
  WHERE jobname = 'update-matches';

  -- Récupérer le dernier log
  SELECT * INTO last_log
  FROM cron_logs
  WHERE job_name = 'update-matches'
  ORDER BY created_at DESC
  LIMIT 1;

  result := jsonb_build_object(
    'enabled', job_record IS NOT NULL,
    'schedule', COALESCE(job_record.schedule, null),
    'lastRun', last_log.created_at,
    'lastStatus', last_log.status,
    'lastMessage', last_log.message,
    'lastCompetitionsUpdated', last_log.competitions_updated
  );

  RETURN result;
END;
$$;

-- 5. Donner les permissions aux fonctions
GRANT EXECUTE ON FUNCTION call_update_matches_api() TO service_role;
GRANT EXECUTE ON FUNCTION manage_update_cron(BOOLEAN, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION get_cron_status() TO service_role, authenticated;

-- ============================================
-- Pour activer le cron manuellement depuis le SQL Editor:
-- SELECT manage_update_cron(true, '0 18-23 * * *');
--
-- Pour désactiver:
-- SELECT manage_update_cron(false);
--
-- Pour voir le statut:
-- SELECT get_cron_status();
--
-- Pour voir les logs:
-- SELECT * FROM cron_logs ORDER BY created_at DESC LIMIT 20;
-- ============================================
