-- =====================================================
-- MIGRATION: Nouveau système de pricing PronoHub v2
-- Date: 2025-12-02
-- =====================================================
-- Règles:
-- FREE-KICK: 2 tournois gratuits max, 10 journées max, 5 joueurs max
--   - Slot invité: 0.99€ (pour 3ème tournoi+)
--   - Extension durée: 3.99€ (jusqu'à fin compétition)
--   - Extension joueurs: 1.99€ (+5 joueurs, avant démarrage)
-- ONE-SHOT: Créateur paie 4.99€, invite jusqu'à 9 joueurs gratuit
--   - Invités gratuits limités à 1 one-shot/elite à la fois
--   - Slot invité: 0.99€ pour rejoindre un 2ème
-- ELITE TEAM: Créateur paie 9.99€, invite jusqu'à 19 joueurs gratuit
--   - Mêmes règles que one-shot
-- PLATINIUM: Créateur paie 6.99€, chaque participant paie 6.99€
--   - Minimum 11 joueurs pour démarrer, max 30
-- =====================================================

-- 1. Mettre à jour la contrainte tournament_type
ALTER TABLE public.tournaments
DROP CONSTRAINT IF EXISTS tournaments_tournament_type_check;

ALTER TABLE public.tournaments
ADD CONSTRAINT tournaments_tournament_type_check
CHECK (tournament_type IN ('free', 'oneshot', 'elite', 'platinium', 'enterprise'));

-- 2. Ajouter la colonne is_legacy pour les tournois existants
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN DEFAULT FALSE;

-- 3. Marquer tous les tournois existants comme legacy
UPDATE public.tournaments SET is_legacy = TRUE WHERE is_legacy IS NULL OR is_legacy = FALSE;

-- 4. Ajouter les colonnes de configuration au tournoi
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS max_matchdays INTEGER; -- Limite de journées (free = 10 par défaut)

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS duration_extended BOOLEAN DEFAULT FALSE; -- Extension durée achetée

ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS players_extended INTEGER DEFAULT 0; -- Nombre d'extensions joueurs achetées

-- 5. Ajouter les colonnes de statut aux participants
ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS participant_role TEXT DEFAULT 'member'
CHECK (participant_role IN ('captain', 'member'));

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS invite_type TEXT DEFAULT 'free'
CHECK (invite_type IN ('free', 'paid_slot', 'premium_invite'));

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS has_paid BOOLEAN DEFAULT FALSE;

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

-- 6. Mettre à jour les participants existants
-- Le créateur est le capitaine
UPDATE public.tournament_participants tp
SET participant_role = 'captain'
FROM public.tournaments t
WHERE tp.tournament_id = t.id
AND tp.user_id = t.creator_id;

-- Pour les tournois legacy, tout le monde est en "free"
UPDATE public.tournament_participants tp
SET invite_type = 'free', has_paid = FALSE
FROM public.tournaments t
WHERE tp.tournament_id = t.id
AND t.is_legacy = TRUE;

-- 7. Table pour tracker les achats d'extensions et slots
CREATE TABLE IF NOT EXISTS public.tournament_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,

  -- Type d'achat
  purchase_type TEXT NOT NULL CHECK (purchase_type IN (
    'tournament_creation',    -- Création one-shot/elite/platinium
    'slot_invite',            -- Slot invité 0.99€
    'duration_extension',     -- Extension durée 3.99€
    'player_extension',       -- Extension joueurs 1.99€
    'platinium_participation' -- Participation platinium 6.99€
  )),

  -- Montant
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'eur',

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,

  -- Statut
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_purchases_user ON public.tournament_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_tournament ON public.tournament_purchases(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_type ON public.tournament_purchases(purchase_type);

-- RLS pour tournament_purchases
ALTER TABLE public.tournament_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.tournament_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Vue mise à jour pour les quotas utilisateur
DROP VIEW IF EXISTS public.user_quotas;

CREATE OR REPLACE VIEW public.user_quotas AS
SELECT
  p.id as user_id,
  p.username,

  -- Compteur tournois FREE actifs (participation, max 2)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND COALESCE(t.tournament_type, 'free') = 'free'
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
    AND tp.invite_type = 'free' -- Seulement les slots gratuits
  )::INTEGER as free_tournaments_active,
  2 as free_tournaments_max,

  -- Nombre de tournois free avec slot payé (pas de limite)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND COALESCE(t.tournament_type, 'free') = 'free'
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
    AND tp.invite_type = 'paid_slot'
  )::INTEGER as free_tournaments_paid_slots,

  -- Tournois ONE-SHOT/ELITE où l'user est invité gratuit (max 1)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND t.tournament_type IN ('oneshot', 'elite')
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
    AND tp.invite_type = 'premium_invite'
    AND tp.participant_role = 'member' -- Pas le créateur
  )::INTEGER as premium_invites_active,
  1 as premium_invites_max,

  -- Tournois PLATINIUM actifs
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND t.tournament_type = 'platinium'
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
  )::INTEGER as platinium_tournaments_active,

  -- Tournois legacy (pas de limite, ils continuent normalement)
  (
    SELECT COUNT(*)
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p.id
    AND t.is_legacy = TRUE
    AND t.status IN ('warmup', 'active')
  )::INTEGER as legacy_tournaments_active,

  -- Peut créer un tournoi FREE ?
  CASE
    WHEN (
      SELECT COUNT(*) FROM public.tournament_participants tp
      JOIN public.tournaments t ON t.id = tp.tournament_id
      WHERE tp.user_id = p.id
      AND COALESCE(t.tournament_type, 'free') = 'free'
      AND t.status IN ('warmup', 'active')
      AND t.is_legacy = FALSE
      AND tp.invite_type = 'free'
    ) < 2 THEN TRUE
    ELSE FALSE
  END as can_create_free_tournament,

  -- Peut rejoindre un tournoi premium gratuit ?
  CASE
    WHEN (
      SELECT COUNT(*) FROM public.tournament_participants tp
      JOIN public.tournaments t ON t.id = tp.tournament_id
      WHERE tp.user_id = p.id
      AND t.tournament_type IN ('oneshot', 'elite')
      AND t.status IN ('warmup', 'active')
      AND t.is_legacy = FALSE
      AND tp.invite_type = 'premium_invite'
      AND tp.participant_role = 'member'
    ) < 1 THEN TRUE
    ELSE FALSE
  END as can_join_premium_free

FROM public.profiles p;

-- 9. Fonction pour vérifier si un utilisateur peut rejoindre un tournoi
CREATE OR REPLACE FUNCTION public.can_user_join_tournament(
  p_user_id UUID,
  p_tournament_id UUID
) RETURNS TABLE(
  can_join BOOLEAN,
  requires_payment BOOLEAN,
  payment_amount DECIMAL(10,2),
  payment_type TEXT,
  reason TEXT
) AS $$
DECLARE
  v_tournament RECORD;
  v_participant_count INTEGER;
  v_user_free_count INTEGER;
  v_user_premium_invite_count INTEGER;
  v_already_participant BOOLEAN;
BEGIN
  -- Récupérer le tournoi
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;

  IF v_tournament IS NULL THEN
    RETURN QUERY SELECT FALSE, FALSE, 0::DECIMAL, ''::TEXT, 'Tournoi introuvable';
    RETURN;
  END IF;

  -- Vérifier si déjà participant
  SELECT EXISTS(
    SELECT 1 FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id
  ) INTO v_already_participant;

  IF v_already_participant THEN
    RETURN QUERY SELECT FALSE, FALSE, 0::DECIMAL, ''::TEXT, 'Déjà participant';
    RETURN;
  END IF;

  -- Compter les participants actuels
  SELECT COUNT(*) INTO v_participant_count
  FROM public.tournament_participants WHERE tournament_id = p_tournament_id;

  -- Vérifier la limite de joueurs
  IF v_participant_count >= v_tournament.max_players THEN
    RETURN QUERY SELECT FALSE, FALSE, 0::DECIMAL, ''::TEXT, 'Tournoi complet';
    RETURN;
  END IF;

  -- Tournoi legacy = pas de restrictions
  IF v_tournament.is_legacy = TRUE THEN
    RETURN QUERY SELECT TRUE, FALSE, 0::DECIMAL, ''::TEXT, 'Tournoi legacy - accès libre';
    RETURN;
  END IF;

  -- FREE: Vérifier le quota de l'utilisateur
  IF v_tournament.tournament_type = 'free' THEN
    SELECT COUNT(*) INTO v_user_free_count
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p_user_id
    AND t.tournament_type = 'free'
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
    AND tp.invite_type = 'free';

    IF v_user_free_count < 2 THEN
      RETURN QUERY SELECT TRUE, FALSE, 0::DECIMAL, ''::TEXT, 'Slot gratuit disponible';
    ELSE
      RETURN QUERY SELECT TRUE, TRUE, 0.99::DECIMAL, 'slot_invite'::TEXT, 'Slot payant requis (0.99€)';
    END IF;
    RETURN;
  END IF;

  -- ONE-SHOT / ELITE: Vérifier si peut être invité gratuit
  IF v_tournament.tournament_type IN ('oneshot', 'elite') THEN
    SELECT COUNT(*) INTO v_user_premium_invite_count
    FROM public.tournament_participants tp
    JOIN public.tournaments t ON t.id = tp.tournament_id
    WHERE tp.user_id = p_user_id
    AND t.tournament_type IN ('oneshot', 'elite')
    AND t.status IN ('warmup', 'active')
    AND t.is_legacy = FALSE
    AND tp.invite_type = 'premium_invite'
    AND tp.participant_role = 'member';

    IF v_user_premium_invite_count < 1 THEN
      RETURN QUERY SELECT TRUE, FALSE, 0::DECIMAL, 'premium_invite'::TEXT, 'Invitation gratuite';
    ELSE
      RETURN QUERY SELECT TRUE, TRUE, 0.99::DECIMAL, 'slot_invite'::TEXT, 'Slot payant requis (0.99€)';
    END IF;
    RETURN;
  END IF;

  -- PLATINIUM: Tout le monde paie
  IF v_tournament.tournament_type = 'platinium' THEN
    RETURN QUERY SELECT TRUE, TRUE, 6.99::DECIMAL, 'platinium_participation'::TEXT, 'Participation payante (6.99€)';
    RETURN;
  END IF;

  -- Cas par défaut
  RETURN QUERY SELECT TRUE, FALSE, 0::DECIMAL, ''::TEXT, 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Fonction pour vérifier si un tournoi peut démarrer
CREATE OR REPLACE FUNCTION public.can_tournament_start(p_tournament_id UUID)
RETURNS TABLE(
  can_start BOOLEAN,
  reason TEXT,
  current_players INTEGER,
  min_players INTEGER
) AS $$
DECLARE
  v_tournament RECORD;
  v_participant_count INTEGER;
  v_min_players INTEGER;
BEGIN
  SELECT * INTO v_tournament FROM public.tournaments WHERE id = p_tournament_id;

  IF v_tournament IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Tournoi introuvable'::TEXT, 0, 0;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_participant_count
  FROM public.tournament_participants WHERE tournament_id = p_tournament_id;

  -- Définir le minimum selon le type
  v_min_players := CASE v_tournament.tournament_type
    WHEN 'platinium' THEN 11
    ELSE 2
  END;

  IF v_participant_count < v_min_players THEN
    RETURN QUERY SELECT FALSE,
      format('Minimum %s joueurs requis', v_min_players)::TEXT,
      v_participant_count,
      v_min_players;
  ELSE
    RETURN QUERY SELECT TRUE, 'OK'::TEXT, v_participant_count, v_min_players;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Index supplémentaires pour les performances
CREATE INDEX IF NOT EXISTS idx_tournaments_is_legacy ON public.tournaments(is_legacy);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_invite_type ON public.tournament_participants(invite_type);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_role ON public.tournament_participants(participant_role);

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
