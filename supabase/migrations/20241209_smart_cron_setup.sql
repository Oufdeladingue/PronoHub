-- ============================================
-- Migration: Setup système de MAJ intelligente
-- À exécuter dans le SQL Editor de Supabase APRÈS 20241209_pg_cron_setup.sql
-- ============================================

-- 1. Table pour les fenêtres de matchs actives
-- Stocke les créneaux où des matchs sont en cours/prévus pour optimiser les appels API
CREATE TABLE IF NOT EXISTS match_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,  -- Début de la fenêtre (kickoff - marge)
  window_end TIMESTAMPTZ NOT NULL,    -- Fin de la fenêtre (kickoff + durée max)
  matches_count INTEGER DEFAULT 1,    -- Nombre de matchs dans cette fenêtre
  has_live_matches BOOLEAN DEFAULT false, -- Y a-t-il des matchs en cours ?
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(competition_id, match_date, window_start)
);

-- Index pour trouver rapidement les fenêtres actives
CREATE INDEX IF NOT EXISTS idx_match_windows_active ON match_windows(window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_match_windows_competition ON match_windows(competition_id);
CREATE INDEX IF NOT EXISTS idx_match_windows_date ON match_windows(match_date);

-- 2. Table pour le suivi des appels API (quotas)
CREATE TABLE IF NOT EXISTS api_calls_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_name TEXT NOT NULL DEFAULT 'football-data',
  call_type TEXT NOT NULL, -- 'daily_sync', 'live_update', 'manual'
  competition_id INTEGER,
  success BOOLEAN DEFAULT true,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour compter les appels du jour
CREATE INDEX IF NOT EXISTS idx_api_calls_today ON api_calls_log(created_at, api_name);

-- RLS pour api_calls_log
ALTER TABLE api_calls_log ENABLE ROW LEVEL SECURITY;

-- Policy pour permettre aux admins de lire les logs API
CREATE POLICY "Allow authenticated to read api_calls_log" ON api_calls_log
  FOR SELECT TO authenticated USING (true);

-- Policy pour permettre l'insertion (depuis les routes API)
CREATE POLICY "Allow insert to api_calls_log" ON api_calls_log
  FOR INSERT TO authenticated, service_role WITH CHECK (true);

-- Nettoyage automatique des logs API > 7 jours
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM api_calls_log WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- 3. Fonction pour générer les fenêtres de matchs à partir des matchs importés
CREATE OR REPLACE FUNCTION generate_match_windows(
  p_margin_before_minutes INTEGER DEFAULT 5,
  p_match_duration_minutes INTEGER DEFAULT 120
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  windows_created INTEGER := 0;
  comp_record RECORD;
  match_record RECORD;
  window_start_time TIMESTAMPTZ;
  window_end_time TIMESTAMPTZ;
BEGIN
  -- Supprimer les anciennes fenêtres (matchs passés)
  DELETE FROM match_windows WHERE window_end < NOW() - INTERVAL '1 hour';

  -- Pour chaque compétition active
  FOR comp_record IN
    SELECT id FROM competitions WHERE is_active = true
  LOOP
    -- Pour chaque match à venir ou en cours
    FOR match_record IN
      SELECT
        football_data_match_id,
        utc_date,
        status,
        DATE(utc_date) as match_date
      FROM imported_matches
      WHERE competition_id = comp_record.id
        AND utc_date >= NOW() - INTERVAL '2 hours'
        AND utc_date <= NOW() + INTERVAL '7 days'
        AND status NOT IN ('FINISHED', 'CANCELLED', 'POSTPONED')
      ORDER BY utc_date
    LOOP
      window_start_time := match_record.utc_date - (p_margin_before_minutes || ' minutes')::INTERVAL;
      window_end_time := match_record.utc_date + (p_match_duration_minutes || ' minutes')::INTERVAL;

      -- Insérer ou mettre à jour la fenêtre
      INSERT INTO match_windows (
        competition_id,
        match_date,
        window_start,
        window_end,
        matches_count,
        has_live_matches
      )
      VALUES (
        comp_record.id,
        match_record.match_date,
        window_start_time,
        window_end_time,
        1,
        match_record.status IN ('IN_PLAY', 'PAUSED', 'HALFTIME')
      )
      ON CONFLICT (competition_id, match_date, window_start)
      DO UPDATE SET
        window_end = GREATEST(match_windows.window_end, EXCLUDED.window_end),
        matches_count = match_windows.matches_count + 1,
        has_live_matches = match_windows.has_live_matches OR EXCLUDED.has_live_matches,
        updated_at = NOW();

      windows_created := windows_created + 1;
    END LOOP;
  END LOOP;

  RETURN windows_created;
END;
$$;

-- 4. Fonction pour vérifier si on est dans une fenêtre de match active
CREATE OR REPLACE FUNCTION is_in_match_window()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_windows INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_windows
  FROM match_windows
  WHERE NOW() BETWEEN window_start AND window_end;

  RETURN active_windows > 0;
END;
$$;

-- 5. Fonction pour obtenir les compétitions avec des matchs en cours
CREATE OR REPLACE FUNCTION get_competitions_with_live_matches()
RETURNS TABLE(competition_id INTEGER, competition_name TEXT, matches_in_window INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    mw.competition_id,
    c.name,
    mw.matches_count
  FROM match_windows mw
  JOIN competitions c ON c.id = mw.competition_id
  WHERE NOW() BETWEEN mw.window_start AND mw.window_end
  ORDER BY mw.matches_count DESC;
END;
$$;

-- 6. Fonction pour compter les appels API du jour
CREATE OR REPLACE FUNCTION get_api_calls_today()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO calls_count
  FROM api_calls_log
  WHERE created_at >= DATE_TRUNC('day', NOW())
    AND api_name = 'football-data';

  RETURN COALESCE(calls_count, 0);
END;
$$;

-- 7. Fonction principale pour décider si on doit faire une MAJ
CREATE OR REPLACE FUNCTION should_update_now()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  smart_mode_enabled BOOLEAN;
  in_window BOOLEAN;
  fallback_interval_minutes INTEGER;
  last_update TIMESTAMPTZ;
  minutes_since_last_update INTEGER;
  api_calls_today INTEGER;
BEGIN
  -- Récupérer les paramètres
  SELECT (setting_value = 'true') INTO smart_mode_enabled
  FROM admin_settings WHERE setting_key = 'cron_smart_mode_enabled';

  SELECT setting_value::integer INTO fallback_interval_minutes
  FROM admin_settings WHERE setting_key = 'cron_fallback_interval';

  SELECT setting_value::timestamptz INTO last_update
  FROM admin_settings WHERE setting_key = 'cron_last_run';

  -- Calculer le temps depuis la dernière MAJ
  minutes_since_last_update := EXTRACT(EPOCH FROM (NOW() - COALESCE(last_update, NOW() - INTERVAL '1 day'))) / 60;

  -- Compter les appels API du jour
  api_calls_today := get_api_calls_today();

  -- Vérifier si on est dans une fenêtre de match
  in_window := is_in_match_window();

  -- Construire le résultat
  result := jsonb_build_object(
    'smartModeEnabled', COALESCE(smart_mode_enabled, false),
    'inMatchWindow', in_window,
    'minutesSinceLastUpdate', minutes_since_last_update,
    'fallbackIntervalMinutes', COALESCE(fallback_interval_minutes, 15),
    'apiCallsToday', api_calls_today,
    'shouldUpdate', false,
    'reason', 'checking'
  );

  -- Logique de décision
  IF COALESCE(smart_mode_enabled, false) THEN
    -- Mode intelligent activé
    IF in_window THEN
      -- Dans une fenêtre de match = MAJ fréquente
      result := result || jsonb_build_object(
        'shouldUpdate', true,
        'reason', 'in_match_window'
      );
    ELSE
      -- Hors fenêtre = pas de MAJ (sauf sync quotidienne)
      result := result || jsonb_build_object(
        'shouldUpdate', false,
        'reason', 'outside_match_window'
      );
    END IF;
  ELSE
    -- Mode fallback (intervalle fixe)
    IF minutes_since_last_update >= COALESCE(fallback_interval_minutes, 15) THEN
      result := result || jsonb_build_object(
        'shouldUpdate', true,
        'reason', 'fallback_interval_reached'
      );
    ELSE
      result := result || jsonb_build_object(
        'shouldUpdate', false,
        'reason', 'fallback_interval_not_reached'
      );
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- 8. Mettre à jour la fonction call_update_matches_api pour utiliser le mode intelligent
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
  should_update_result JSONB;
  delay_between_competitions INTEGER;
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

  -- Vérifier si on doit faire la MAJ maintenant
  should_update_result := should_update_now();

  IF NOT (should_update_result->>'shouldUpdate')::boolean THEN
    INSERT INTO cron_logs (job_name, status, message)
    VALUES (
      'update-matches',
      'skipped',
      'Skipped: ' || (should_update_result->>'reason') ||
      ' (API calls today: ' || (should_update_result->>'apiCallsToday') || ')'
    );
    RETURN;
  END IF;

  -- Récupérer l'URL de l'app
  SELECT setting_value INTO app_url
  FROM admin_settings
  WHERE setting_key = 'app_url';
  app_url := COALESCE(app_url, 'https://prono-hub.vercel.app');

  -- Récupérer le secret cron
  SELECT setting_value INTO cron_secret
  FROM admin_settings
  WHERE setting_key = 'cron_secret';

  -- Récupérer le délai entre compétitions
  SELECT setting_value::integer INTO delay_between_competitions
  FROM admin_settings
  WHERE setting_key = 'cron_delay_between_competitions';
  delay_between_competitions := COALESCE(delay_between_competitions, 5);

  -- Appeler l'API via pg_net
  SELECT status, content::jsonb INTO response_status, response_body
  FROM net.http_post(
    url := app_url || '/api/football/auto-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
    ),
    body := jsonb_build_object(
      'delayBetweenCompetitions', delay_between_competitions,
      'smartMode', (should_update_result->>'smartModeEnabled')::boolean,
      'reason', should_update_result->>'reason'
    )
  );

  -- Logger le résultat
  IF response_status = 200 THEN
    INSERT INTO cron_logs (job_name, status, message, competitions_updated, execution_time_ms)
    VALUES (
      'update-matches',
      'success',
      COALESCE(response_body->>'message', 'OK') || ' (' || (should_update_result->>'reason') || ')',
      COALESCE((response_body->>'successCount')::integer, 0),
      EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer
    );

    -- Logger l'appel API
    INSERT INTO api_calls_log (call_type, success, response_time_ms)
    VALUES (
      CASE WHEN (should_update_result->>'inMatchWindow')::boolean THEN 'live_update' ELSE 'scheduled' END,
      true,
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

    -- Logger l'appel API échoué
    INSERT INTO api_calls_log (call_type, success, response_time_ms)
    VALUES ('live_update', false, EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer);
  END IF;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_logs (job_name, status, message)
  VALUES ('update-matches', 'error', SQLERRM);
END;
$$;

-- 9. Fonction pour la synchronisation quotidienne (calendrier)
CREATE OR REPLACE FUNCTION call_daily_sync_api()
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
  daily_sync_enabled BOOLEAN;
  delay_seconds INTEGER;
BEGIN
  start_time := NOW();

  -- Vérifier si la sync quotidienne est activée
  SELECT (setting_value = 'true') INTO daily_sync_enabled
  FROM admin_settings
  WHERE setting_key = 'cron_daily_sync_enabled';

  IF NOT COALESCE(daily_sync_enabled, true) THEN
    INSERT INTO cron_logs (job_name, status, message)
    VALUES ('daily-sync', 'skipped', 'Daily sync is disabled');
    RETURN;
  END IF;

  -- Récupérer les paramètres
  SELECT setting_value INTO app_url FROM admin_settings WHERE setting_key = 'app_url';
  app_url := COALESCE(app_url, 'https://prono-hub.vercel.app');

  SELECT setting_value INTO cron_secret FROM admin_settings WHERE setting_key = 'cron_secret';

  SELECT setting_value::integer INTO delay_seconds FROM admin_settings WHERE setting_key = 'cron_delay_between_competitions';
  delay_seconds := COALESCE(delay_seconds, 5);

  -- Appeler l'API de sync quotidienne
  SELECT status, content::jsonb INTO response_status, response_body
  FROM net.http_post(
    url := app_url || '/api/football/auto-update',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(cron_secret, '')
    ),
    body := jsonb_build_object(
      'delayBetweenCompetitions', delay_seconds,
      'isDailySync', true
    )
  );

  -- Logger
  IF response_status = 200 THEN
    INSERT INTO cron_logs (job_name, status, message, competitions_updated, execution_time_ms)
    VALUES (
      'daily-sync',
      'success',
      'Daily sync completed: ' || COALESCE(response_body->>'message', 'OK'),
      COALESCE((response_body->>'successCount')::integer, 0),
      EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer
    );

    -- Regénérer les fenêtres de matchs après la sync
    PERFORM generate_match_windows();

    INSERT INTO api_calls_log (call_type, success, response_time_ms)
    VALUES ('daily_sync', true, EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer);
  ELSE
    INSERT INTO cron_logs (job_name, status, message, execution_time_ms)
    VALUES (
      'daily-sync',
      'error',
      'HTTP ' || response_status || ': ' || COALESCE(response_body->>'error', 'Unknown'),
      EXTRACT(MILLISECONDS FROM (NOW() - start_time))::integer
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  INSERT INTO cron_logs (job_name, status, message)
  VALUES ('daily-sync', 'error', SQLERRM);
END;
$$;

-- 10. Fonction pour gérer les deux crons (quotidien + temps réel)
CREATE OR REPLACE FUNCTION manage_smart_cron(
  p_daily_enabled BOOLEAN,
  p_daily_hour TEXT DEFAULT '06:00',
  p_realtime_enabled BOOLEAN DEFAULT false,
  p_realtime_frequency_minutes INTEGER DEFAULT 2
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  daily_schedule TEXT;
  realtime_schedule TEXT;
  result TEXT := '';
BEGIN
  -- Extraire heure et minute du format HH:MM
  daily_schedule := SPLIT_PART(p_daily_hour, ':', 2) || ' ' || SPLIT_PART(p_daily_hour, ':', 1) || ' * * *';

  -- Schedule pour le temps réel (toutes les X minutes)
  realtime_schedule := '*/' || p_realtime_frequency_minutes || ' * * * *';

  -- Gérer le cron quotidien
  IF p_daily_enabled THEN
    -- Supprimer l'ancien job s'il existe
    BEGIN
      PERFORM cron.unschedule('daily-sync');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Créer le nouveau job
    PERFORM cron.schedule('daily-sync', daily_schedule, 'SELECT call_daily_sync_api();');
    result := result || 'Daily sync enabled at ' || p_daily_hour || '. ';
  ELSE
    BEGIN
      PERFORM cron.unschedule('daily-sync');
      result := result || 'Daily sync disabled. ';
    EXCEPTION WHEN OTHERS THEN
      result := result || 'Daily sync was already disabled. ';
    END;
  END IF;

  -- Gérer le cron temps réel
  IF p_realtime_enabled THEN
    BEGIN
      PERFORM cron.unschedule('update-matches');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule('update-matches', realtime_schedule, 'SELECT call_update_matches_api();');
    result := result || 'Realtime updates every ' || p_realtime_frequency_minutes || ' minutes.';
  ELSE
    BEGIN
      PERFORM cron.unschedule('update-matches');
      result := result || 'Realtime updates disabled.';
    EXCEPTION WHEN OTHERS THEN
      result := result || 'Realtime updates were already disabled.';
    END;
  END IF;

  RETURN result;
END;
$$;

-- 11. Fonction pour obtenir le statut complet du système
CREATE OR REPLACE FUNCTION get_smart_cron_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  daily_job RECORD;
  realtime_job RECORD;
  last_daily_log RECORD;
  last_realtime_log RECORD;
  active_windows INTEGER;
  api_calls INTEGER;
BEGIN
  -- Jobs cron
  SELECT * INTO daily_job FROM cron.job WHERE jobname = 'daily-sync';
  SELECT * INTO realtime_job FROM cron.job WHERE jobname = 'update-matches';

  -- Derniers logs
  SELECT * INTO last_daily_log FROM cron_logs WHERE job_name = 'daily-sync' ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO last_realtime_log FROM cron_logs WHERE job_name = 'update-matches' ORDER BY created_at DESC LIMIT 1;

  -- Fenêtres actives
  SELECT COUNT(*) INTO active_windows FROM match_windows WHERE NOW() BETWEEN window_start AND window_end;

  -- Appels API du jour
  api_calls := get_api_calls_today();

  result := jsonb_build_object(
    'dailySync', jsonb_build_object(
      'enabled', daily_job IS NOT NULL,
      'schedule', daily_job.schedule,
      'lastRun', last_daily_log.created_at,
      'lastStatus', last_daily_log.status,
      'lastMessage', last_daily_log.message
    ),
    'realtimeUpdates', jsonb_build_object(
      'enabled', realtime_job IS NOT NULL,
      'schedule', realtime_job.schedule,
      'lastRun', last_realtime_log.created_at,
      'lastStatus', last_realtime_log.status,
      'lastMessage', last_realtime_log.message
    ),
    'matchWindows', jsonb_build_object(
      'activeCount', active_windows,
      'inWindow', active_windows > 0
    ),
    'apiQuota', jsonb_build_object(
      'callsToday', api_calls,
      'estimatedMax', 1440
    )
  );

  RETURN result;
END;
$$;

-- 12. Permissions
GRANT EXECUTE ON FUNCTION generate_match_windows(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION is_in_match_window() TO service_role;
GRANT EXECUTE ON FUNCTION get_competitions_with_live_matches() TO service_role;
GRANT EXECUTE ON FUNCTION get_api_calls_today() TO service_role;
GRANT EXECUTE ON FUNCTION should_update_now() TO service_role;
GRANT EXECUTE ON FUNCTION call_daily_sync_api() TO service_role;
GRANT EXECUTE ON FUNCTION manage_smart_cron(BOOLEAN, TEXT, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_smart_cron_status() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_api_logs() TO service_role;

-- ============================================
-- UTILISATION:
--
-- Activer le mode intelligent:
-- SELECT manage_smart_cron(
--   true,   -- daily sync enabled
--   '06:00', -- daily sync hour
--   true,   -- realtime enabled
--   2       -- check every 2 minutes
-- );
--
-- Voir le statut:
-- SELECT get_smart_cron_status();
--
-- Générer les fenêtres de matchs manuellement:
-- SELECT generate_match_windows();
--
-- Voir les fenêtres actives:
-- SELECT * FROM match_windows WHERE NOW() BETWEEN window_start AND window_end;
-- ============================================
