-- =====================================================
-- MIGRATION: Ajout tracking des credits d'achat
-- Date: 2025-12-02
-- =====================================================
-- Permet de tracker si un achat a ete utilise ou non
-- Ex: user achete One-Shot, le credit reste disponible
-- jusqu'a ce qu'il cree effectivement le tournoi
-- =====================================================

-- 1. Ajouter colonne pour tracker si l'achat a ete utilise
ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS used_for_tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

-- 2. Ajouter le type platinium_group pour paiement groupe
ALTER TABLE public.tournament_purchases
DROP CONSTRAINT IF EXISTS tournament_purchases_purchase_type_check;

ALTER TABLE public.tournament_purchases
ADD CONSTRAINT tournament_purchases_purchase_type_check
CHECK (purchase_type IN (
  'tournament_creation',
  'slot_invite',
  'duration_extension',
  'player_extension',
  'platinium_participation',
  'platinium_group'
));

-- 3. Ajouter colonne pour le sous-type (oneshot, elite, platinium)
ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS tournament_subtype TEXT;

-- 4. Ajouter colonne pour le nombre de places (pour platinium_group)
ALTER TABLE public.tournament_purchases
ADD COLUMN IF NOT EXISTS slots_included INTEGER DEFAULT 1;

-- 5. Vue pour voir les credits disponibles d'un utilisateur
CREATE OR REPLACE VIEW public.user_available_credits AS
SELECT
  p.id as user_id,
  p.username,

  -- Credits One-Shot disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'tournament_creation'
    AND tp.tournament_subtype = 'oneshot'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as oneshot_credits,

  -- Credits Elite disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'tournament_creation'
    AND tp.tournament_subtype = 'elite'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as elite_credits,

  -- Credits Platinium solo disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'platinium_participation'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as platinium_solo_credits,

  -- Credits Platinium groupe disponibles (avec slots)
  (
    SELECT COALESCE(SUM(tp.slots_included), 0)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'platinium_group'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as platinium_group_slots,

  -- Slots invites disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'slot_invite'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as slot_invite_credits,

  -- Extensions duree disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'duration_extension'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as duration_extension_credits,

  -- Extensions joueurs disponibles
  (
    SELECT COUNT(*)
    FROM public.tournament_purchases tp
    WHERE tp.user_id = p.id
    AND tp.purchase_type = 'player_extension'
    AND tp.status = 'completed'
    AND tp.used = FALSE
  )::INTEGER as player_extension_credits

FROM public.profiles p;

-- 6. Fonction pour consommer un credit
CREATE OR REPLACE FUNCTION public.use_purchase_credit(
  p_user_id UUID,
  p_purchase_type TEXT,
  p_tournament_subtype TEXT DEFAULT NULL,
  p_tournament_id UUID DEFAULT NULL
) RETURNS TABLE(
  success BOOLEAN,
  purchase_id UUID,
  message TEXT
) AS $$
DECLARE
  v_purchase RECORD;
BEGIN
  -- Trouver un credit disponible
  SELECT * INTO v_purchase
  FROM public.tournament_purchases
  WHERE user_id = p_user_id
    AND purchase_type = p_purchase_type
    AND (p_tournament_subtype IS NULL OR tournament_subtype = p_tournament_subtype)
    AND status = 'completed'
    AND used = FALSE
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_purchase IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Aucun credit disponible'::TEXT;
    RETURN;
  END IF;

  -- Marquer comme utilise
  UPDATE public.tournament_purchases
  SET
    used = TRUE,
    used_at = NOW(),
    used_for_tournament_id = p_tournament_id
  WHERE id = v_purchase.id;

  RETURN QUERY SELECT TRUE, v_purchase.id, 'Credit utilise avec succes'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_used ON public.tournament_purchases(used);
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_subtype ON public.tournament_purchases(tournament_subtype);

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
