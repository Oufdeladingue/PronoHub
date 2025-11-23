-- =====================================================
-- FIX: Compter les tournois auxquels l'utilisateur PARTICIPE
-- (pas seulement ceux qu'il a créés)
-- =====================================================

-- 1. Mise à jour de la VUE user_quotas
DROP VIEW IF EXISTS public.user_quotas;

CREATE OR REPLACE VIEW public.user_quotas AS
SELECT
  p.id as user_id,
  p.username,

  -- Statut abonnement
  COALESCE(us.status, 'none') as subscription_status,
  us.subscription_type,
  us.current_period_end as subscription_expires_at,

  -- Compteur tournois gratuits actifs (participation, max 3)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND COALESCE(t.tournament_type, 'free') = 'free'
    AND t.status != 'completed'
  )::INTEGER as free_tournaments_active,
  3 as free_tournaments_max,

  -- Compteur tournois one-shot actifs (max 2)
  (
    SELECT COUNT(*)
    FROM public.user_oneshot_purchases op
    WHERE op.user_id = p.id
    AND op.status = 'in_use'
  )::INTEGER as oneshot_tournaments_active,
  2 as oneshot_tournaments_max,

  -- Slots one-shot disponibles (achetés mais non utilisés)
  (
    SELECT COUNT(*)
    FROM public.user_oneshot_purchases op
    WHERE op.user_id = p.id
    AND op.status = 'available'
  )::INTEGER as oneshot_slots_available,

  -- Compteur tournois premium actifs via abonnement (participation, max 5)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND t.tournament_type = 'premium'
    AND t.status != 'completed'
  )::INTEGER as premium_tournaments_active,
  CASE
    WHEN us.status = 'active' THEN 5
    ELSE 0
  END as premium_tournaments_max,

  -- Entreprise
  (
    SELECT COUNT(*)
    FROM public.enterprise_accounts ea
    WHERE ea.user_id = p.id
    AND ea.status = 'active'
  )::INTEGER as enterprise_accounts_active,

  -- Résumé: peut créer un tournoi?
  CASE
    -- A un abonnement actif avec des slots dispo
    WHEN us.status = 'active' AND (
      SELECT COUNT(*) FROM public.tournament_participants tp
      JOIN public.tournaments t ON t.id = tp.tournament_id
      WHERE tp.user_id = p.id AND t.tournament_type = 'premium' AND t.status != 'completed'
    ) < 5 THEN TRUE
    -- A un slot one-shot disponible
    WHEN (
      SELECT COUNT(*) FROM public.user_oneshot_purchases op
      WHERE op.user_id = p.id AND op.status = 'available'
    ) > 0 THEN TRUE
    -- A encore des slots gratuits
    WHEN (
      SELECT COUNT(*) FROM public.tournament_participants tp
      JOIN public.tournaments t ON t.id = tp.tournament_id
      WHERE tp.user_id = p.id AND COALESCE(t.tournament_type, 'free') = 'free' AND t.status != 'completed'
    ) < 3 THEN TRUE
    ELSE FALSE
  END as can_create_tournament

FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id AND us.status = 'active';

-- 2. Mise à jour de la FONCTION determine_tournament_type
CREATE OR REPLACE FUNCTION public.determine_tournament_type(p_user_id UUID)
RETURNS TABLE(
  tournament_type TEXT,
  max_players INTEGER,
  reason TEXT
) AS $$
DECLARE
  v_has_subscription BOOLEAN;
  v_premium_count INTEGER;
  v_oneshot_available INTEGER;
  v_free_count INTEGER;
BEGIN
  -- Vérifier abonnement actif
  SELECT EXISTS(
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_has_subscription;

  -- Compter tournois premium actifs (participation)
  SELECT COUNT(*) INTO v_premium_count
  FROM public.tournament_participants tp
  JOIN public.tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = p_user_id
  AND t.tournament_type = 'premium'
  AND t.status != 'completed';

  -- Compter slots one-shot disponibles
  SELECT COUNT(*) INTO v_oneshot_available
  FROM public.user_oneshot_purchases
  WHERE user_id = p_user_id
  AND status = 'available';

  -- Compter tournois gratuits actifs (participation)
  SELECT COUNT(*) INTO v_free_count
  FROM public.tournament_participants tp
  JOIN public.tournaments t ON t.id = tp.tournament_id
  WHERE tp.user_id = p_user_id
  AND COALESCE(t.tournament_type, 'free') = 'free'
  AND t.status != 'completed';

  -- Priorité 1: Abonnement premium (max 5 tournois, 20 joueurs)
  IF v_has_subscription AND v_premium_count < 5 THEN
    RETURN QUERY SELECT 'premium'::TEXT, 20, 'Slot abonnement premium utilisé';
    RETURN;
  END IF;

  -- Priorité 2: One-shot disponible (max 2 actifs, 20 joueurs)
  IF v_oneshot_available > 0 THEN
    RETURN QUERY SELECT 'oneshot'::TEXT, 20, 'Slot one-shot utilisé';
    RETURN;
  END IF;

  -- Priorité 3: Gratuit (max 3 tournois, 8 joueurs)
  IF v_free_count < 3 THEN
    RETURN QUERY SELECT 'free'::TEXT, 8, 'Slot gratuit utilisé';
    RETURN;
  END IF;

  -- Aucun slot disponible
  RETURN QUERY SELECT NULL::TEXT, 0, 'Aucun slot disponible - upgrade requis';
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
