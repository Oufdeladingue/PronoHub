-- =====================================================
-- MIGRATION : Modale de parrainage (stats tournoi public) — 1x/semaine/user
-- Date : 2026-08-12
-- =====================================================
-- Réutilise la table user_modal_views. Ajoute le type 'referral_stats'
-- et 2 RPC gérant un ré-affichage hebdomadaire (basé sur viewed_at).
-- =====================================================

-- 1. Autoriser le nouveau type de modale (remplace le CHECK existant, quel que soit son nom)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.user_modal_views'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%modal_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_modal_views DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.user_modal_views
  ADD CONSTRAINT user_modal_views_modal_type_check
  CHECK (modal_type IN (
    'stats_option',
    'player_extension_2_1',
    'player_extension_0',
    'duration_extension',
    'referral_stats'
  ));

-- 2. RPC : faut-il (ré)afficher la modale ? true si jamais vue OU vue il y a > p_days jours.
CREATE OR REPLACE FUNCTION public.should_show_weekly_modal(
  p_tournament_id UUID,
  p_modal_type TEXT,
  p_days INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_last TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT viewed_at INTO v_last
  FROM public.user_modal_views
  WHERE user_id = v_user_id
    AND tournament_id = p_tournament_id
    AND modal_type = p_modal_type;

  IF v_last IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN v_last < (NOW() - make_interval(days => p_days));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC : marquer la modale comme affichée maintenant (rafraîchit viewed_at chaque semaine)
CREATE OR REPLACE FUNCTION public.mark_weekly_modal_shown(
  p_tournament_id UUID,
  p_modal_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO public.user_modal_views (user_id, tournament_id, modal_type, viewed_at)
  VALUES (v_user_id, p_tournament_id, p_modal_type, NOW())
  ON CONFLICT (user_id, tournament_id, modal_type)
  DO UPDATE SET viewed_at = NOW();

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
