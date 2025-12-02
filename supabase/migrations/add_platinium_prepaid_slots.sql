-- =====================================================
-- MIGRATION: Ajout tracking des places prepayees Platinium
-- Date: 2025-12-02
-- =====================================================
-- Permet au createur d'un tournoi Platinium de prepayer
-- des places pour ses invites (achat groupe de 11 places)
-- =====================================================

-- 1. Ajouter colonne sur tournaments pour les places prepayees restantes
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS prepaid_slots_remaining INTEGER DEFAULT 0;

-- 2. Ajouter colonnes sur tournament_participants pour tracker le paiement
ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS paid_by_creator BOOLEAN DEFAULT FALSE;

-- 3. Ajouter colonne pour lier le paiement groupe au tournoi
ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS slots_used INTEGER DEFAULT 0;

-- 4. Fonction pour utiliser une place prepayee
CREATE OR REPLACE FUNCTION public.use_prepaid_slot(
  p_tournament_id UUID,
  p_user_id UUID
) RETURNS TABLE(
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_tournament RECORD;
BEGIN
  -- Verifier s'il reste des places prepayees
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF v_tournament IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Tournoi non trouve'::TEXT;
    RETURN;
  END IF;

  IF v_tournament.prepaid_slots_remaining <= 0 THEN
    RETURN QUERY SELECT FALSE, 'Aucune place prepayee disponible'::TEXT;
    RETURN;
  END IF;

  -- Decrementer le compteur
  UPDATE public.tournaments
  SET prepaid_slots_remaining = prepaid_slots_remaining - 1
  WHERE id = p_tournament_id;

  RETURN QUERY SELECT TRUE, 'Place prepayee utilisee avec succes'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction pour ajouter des places prepayees (apres achat groupe)
CREATE OR REPLACE FUNCTION public.add_prepaid_slots(
  p_tournament_id UUID,
  p_slots_count INTEGER
) RETURNS TABLE(
  success BOOLEAN,
  new_total INTEGER,
  message TEXT
) AS $$
DECLARE
  v_new_total INTEGER;
BEGIN
  UPDATE public.tournaments
  SET prepaid_slots_remaining = COALESCE(prepaid_slots_remaining, 0) + p_slots_count
  WHERE id = p_tournament_id
  RETURNING prepaid_slots_remaining INTO v_new_total;

  IF v_new_total IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Tournoi non trouve'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, v_new_total, 'Places ajoutees avec succes'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Vue pour voir le statut des places d'un tournoi Platinium
CREATE OR REPLACE VIEW public.tournament_slots_status AS
SELECT
  t.id as tournament_id,
  t.name as tournament_name,
  t.tournament_type,
  t.max_players,
  t.prepaid_slots_remaining,
  (SELECT COUNT(*) FROM public.tournament_participants tp WHERE tp.tournament_id = t.id)::INTEGER as current_players,
  (SELECT COUNT(*) FROM public.tournament_participants tp WHERE tp.tournament_id = t.id AND tp.has_paid = TRUE)::INTEGER as paid_players,
  (SELECT COUNT(*) FROM public.tournament_participants tp WHERE tp.tournament_id = t.id AND tp.paid_by_creator = TRUE)::INTEGER as creator_paid_players
FROM public.tournaments t
WHERE t.tournament_type = 'platinium';

-- 7. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tournaments_prepaid_slots ON public.tournaments(prepaid_slots_remaining) WHERE tournament_type = 'platinium';

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
