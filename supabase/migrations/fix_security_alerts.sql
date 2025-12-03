-- Migration pour corriger les alertes de sécurité Supabase
-- Date: 2025-12-03

-- ============================================
-- PARTIE 1: Corriger les vues SECURITY DEFINER
-- Ces vues doivent utiliser SECURITY INVOKER pour respecter RLS
-- ============================================

-- 1. user_quotas - Recréer sans SECURITY DEFINER
DROP VIEW IF EXISTS public.user_quotas;
CREATE VIEW public.user_quotas WITH (security_invoker = true) AS
SELECT
  p.id as user_id,
  p.username,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_participants tp
     JOIN tournaments t ON t.id = tp.tournament_id
     WHERE tp.user_id = p.id
     AND t.tournament_type = 'free'
     AND t.status NOT IN ('completed', 'cancelled')),
    0
  )::INTEGER as free_tournaments_participating,
  2 as free_tournaments_max,
  COALESCE(
    (SELECT COUNT(*) FROM tournaments t
     WHERE (t.original_creator_id = p.id OR (t.creator_id = p.id AND t.original_creator_id IS NULL))
     AND t.tournament_type = 'oneshot'
     AND t.status NOT IN ('completed', 'cancelled')),
    0
  )::INTEGER as oneshot_created,
  COALESCE(
    (SELECT COUNT(*) FROM tournaments t
     WHERE (t.original_creator_id = p.id OR (t.creator_id = p.id AND t.original_creator_id IS NULL))
     AND t.tournament_type = 'elite'
     AND t.status NOT IN ('completed', 'cancelled')),
    0
  )::INTEGER as elite_created,
  COALESCE(
    (SELECT COUNT(*) FROM tournaments t
     WHERE (t.original_creator_id = p.id OR (t.creator_id = p.id AND t.original_creator_id IS NULL))
     AND t.tournament_type = 'platinium'
     AND t.status NOT IN ('completed', 'cancelled')),
    0
  )::INTEGER as platinium_created
FROM profiles p;

-- 2. user_available_credits - Recréer sans SECURITY DEFINER
DROP VIEW IF EXISTS public.user_available_credits;
CREATE VIEW public.user_available_credits WITH (security_invoker = true) AS
SELECT
  p.id as user_id,
  p.username,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'tournament_creation'
     AND tp.tournament_subtype = 'oneshot'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as oneshot_credits,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'tournament_creation'
     AND tp.tournament_subtype = 'elite'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as elite_credits,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'tournament_creation'
     AND tp.tournament_subtype = 'platinium_solo'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as platinium_solo_credits,
  COALESCE(
    (SELECT SUM(tp.slots_included) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'tournament_creation'
     AND tp.tournament_subtype = 'platinium_group'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as platinium_group_slots,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'slot_invite'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as slot_invite_credits,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'duration_extension'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as duration_extension_credits,
  COALESCE(
    (SELECT COUNT(*) FROM tournament_purchases tp
     WHERE tp.user_id = p.id
     AND tp.purchase_type = 'player_extension'
     AND tp.status = 'completed'
     AND tp.used = false),
    0
  )::INTEGER as player_extension_credits
FROM profiles p;

-- 3. current_prices - Recréer sans SECURITY DEFINER
DROP VIEW IF EXISTS public.current_prices;
CREATE VIEW public.current_prices WITH (security_invoker = true) AS
SELECT
  id,
  config_key,
  config_value,
  config_type,
  label,
  description,
  category,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM pricing_config
WHERE is_active = true;

-- 4. current_day_api_usage - Supprimer (table api_usage_daily n'existe pas)
DROP VIEW IF EXISTS public.current_day_api_usage;

-- 5. daily_api_usage - Supprimer (table api_usage_daily n'existe pas)
DROP VIEW IF EXISTS public.daily_api_usage;

-- Accorder les permissions sur les vues
GRANT SELECT ON public.user_quotas TO authenticated;
GRANT SELECT ON public.user_available_credits TO authenticated;
GRANT SELECT ON public.current_prices TO anon, authenticated;

-- ============================================
-- PARTIE 2: Activer RLS sur les tables non protégées
-- ============================================

-- 1. tournament_bonus_matches
ALTER TABLE public.tournament_bonus_matches ENABLE ROW LEVEL SECURITY;

-- Policies pour tournament_bonus_matches
DROP POLICY IF EXISTS "Users can view bonus matches of their tournaments" ON public.tournament_bonus_matches;
CREATE POLICY "Users can view bonus matches of their tournaments" ON public.tournament_bonus_matches
  FOR SELECT
  USING (
    tournament_id IN (
      SELECT tournament_id FROM tournament_participants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tournament creators can manage bonus matches" ON public.tournament_bonus_matches;
CREATE POLICY "Tournament creators can manage bonus matches" ON public.tournament_bonus_matches
  FOR ALL
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE creator_id = auth.uid()
    )
  );

-- 2. competition_config
ALTER TABLE public.competition_config ENABLE ROW LEVEL SECURITY;

-- Policies pour competition_config (lecture seule pour tous les authentifiés)
DROP POLICY IF EXISTS "Anyone can view competition config" ON public.competition_config;
CREATE POLICY "Anyone can view competition config" ON public.competition_config
  FOR SELECT
  USING (true);

-- Seul le service role peut modifier (via API backend)
DROP POLICY IF EXISTS "Service role can manage competition config" ON public.competition_config;
CREATE POLICY "Service role can manage competition config" ON public.competition_config
  FOR ALL
  USING (auth.role() = 'service_role');

-- 3. user_trophies
ALTER TABLE public.user_trophies ENABLE ROW LEVEL SECURITY;

-- Policies pour user_trophies
DROP POLICY IF EXISTS "Users can view all trophies" ON public.user_trophies;
CREATE POLICY "Users can view all trophies" ON public.user_trophies
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage their own trophies" ON public.user_trophies;
CREATE POLICY "Users can manage their own trophies" ON public.user_trophies
  FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================
