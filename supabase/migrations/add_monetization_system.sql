-- =====================================================
-- MIGRATION: Système de monétisation PronoHub
-- =====================================================

-- 0. FONCTION: update_updated_at_column (si elle n'existe pas deja)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. TABLE: user_subscriptions
-- Gère les abonnements des utilisateurs (Premium mensuel/annuel)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Type d'abonnement
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('monthly', 'yearly')),

  -- Statut de l'abonnement
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),

  -- Informations Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un seul abonnement actif par utilisateur
  UNIQUE(user_id, status) -- Permet plusieurs cancelled/expired mais un seul active
);

-- 2. TABLE: user_oneshot_purchases
-- Gère les achats ponctuels de tournois premium
CREATE TABLE IF NOT EXISTS public.user_oneshot_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Lien avec le tournoi (NULL tant que non utilisé)
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,

  -- Statut du slot
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'expired')),

  -- Informations Stripe
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount_paid INTEGER, -- en centimes
  currency TEXT DEFAULT 'eur',

  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ, -- Quand le tournoi se termine

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE: enterprise_accounts
-- Gère les comptes entreprise
CREATE TABLE IF NOT EXISTS public.enterprise_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Informations entreprise
  company_name TEXT NOT NULL,
  contact_email TEXT,

  -- Branding
  custom_logo_url TEXT,
  primary_color TEXT DEFAULT '#ff9900',
  secondary_color TEXT DEFAULT '#1a1a2e',

  -- Lien avec le tournoi (1 seul par achat)
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  competition_id INTEGER, -- La compétition dédiée

  -- Statut
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),

  -- Limites
  max_participants INTEGER DEFAULT 300,

  -- Informations paiement
  stripe_payment_intent_id TEXT,
  amount_paid INTEGER,
  currency TEXT DEFAULT 'eur',

  -- Dates
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MODIFICATION: Ajouter tournament_type à la table tournaments
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS tournament_type TEXT DEFAULT 'free'
CHECK (tournament_type IN ('free', 'oneshot', 'premium', 'enterprise'));

-- 5. MODIFICATION: Ajouter une colonne pour savoir si c'est un tournoi privé
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

-- 6. VUE: user_quotas (quotas calculés dynamiquement)
CREATE OR REPLACE VIEW public.user_quotas AS
SELECT
  p.id as user_id,
  p.username,

  -- Statut abonnement
  COALESCE(us.status, 'none') as subscription_status,
  us.subscription_type,
  us.current_period_end as subscription_expires_at,

  -- Compteur tournois gratuits actifs (max 3)
  (
    SELECT COUNT(*)
    FROM public.tournaments t
    WHERE t.creator_id = p.id
    AND t.tournament_type = 'free'
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

  -- Compteur tournois premium actifs via abonnement (max 5)
  (
    SELECT COUNT(*)
    FROM public.tournaments t
    WHERE t.creator_id = p.id
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
      SELECT COUNT(*) FROM public.tournaments t
      WHERE t.creator_id = p.id AND t.tournament_type = 'premium' AND t.status != 'completed'
    ) < 5 THEN TRUE
    -- A un slot one-shot disponible
    WHEN (
      SELECT COUNT(*) FROM public.user_oneshot_purchases op
      WHERE op.user_id = p.id AND op.status = 'available'
    ) > 0 THEN TRUE
    -- A encore des slots gratuits
    WHEN (
      SELECT COUNT(*) FROM public.tournaments t
      WHERE t.creator_id = p.id AND t.tournament_type = 'free' AND t.status != 'completed'
    ) < 3 THEN TRUE
    ELSE FALSE
  END as can_create_tournament

FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id AND us.status = 'active';

-- 7. FONCTION: Déterminer le type de tournoi à créer
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

  -- Compter tournois premium actifs
  SELECT COUNT(*) INTO v_premium_count
  FROM public.tournaments
  WHERE creator_id = p_user_id
  AND tournament_type = 'premium'
  AND status != 'completed';

  -- Compter slots one-shot disponibles
  SELECT COUNT(*) INTO v_oneshot_available
  FROM public.user_oneshot_purchases
  WHERE user_id = p_user_id
  AND status = 'available';

  -- Compter tournois gratuits actifs
  SELECT COUNT(*) INTO v_free_count
  FROM public.tournaments
  WHERE creator_id = p_user_id
  AND tournament_type = 'free'
  AND status != 'completed';

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

-- 8. FONCTION: Utiliser un slot one-shot pour un tournoi
CREATE OR REPLACE FUNCTION public.use_oneshot_slot(
  p_user_id UUID,
  p_tournament_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_slot_id UUID;
BEGIN
  -- Trouver un slot disponible
  SELECT id INTO v_slot_id
  FROM public.user_oneshot_purchases
  WHERE user_id = p_user_id
  AND status = 'available'
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_slot_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Utiliser le slot
  UPDATE public.user_oneshot_purchases
  SET
    status = 'in_use',
    tournament_id = p_tournament_id,
    used_at = NOW(),
    updated_at = NOW()
  WHERE id = v_slot_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. FONCTION: Libérer un slot quand le tournoi se termine
CREATE OR REPLACE FUNCTION public.release_tournament_slot()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le tournoi passe à 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Libérer le slot one-shot si applicable
    UPDATE public.user_oneshot_purchases
    SET
      status = 'expired',
      expired_at = NOW(),
      updated_at = NOW()
    WHERE tournament_id = NEW.id
    AND status = 'in_use';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour libérer les slots
DROP TRIGGER IF EXISTS trigger_release_tournament_slot ON public.tournaments;
CREATE TRIGGER trigger_release_tournament_slot
  AFTER UPDATE ON public.tournaments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.release_tournament_slot();

-- 10. INDEX pour les performances
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON public.user_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_user_oneshot_user ON public.user_oneshot_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oneshot_status ON public.user_oneshot_purchases(status);
CREATE INDEX IF NOT EXISTS idx_user_oneshot_tournament ON public.user_oneshot_purchases(tournament_id);

CREATE INDEX IF NOT EXISTS idx_enterprise_accounts_user ON public.enterprise_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_accounts_status ON public.enterprise_accounts(status);

CREATE INDEX IF NOT EXISTS idx_tournaments_type ON public.tournaments(tournament_type);

-- 11. RLS Policies
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_oneshot_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_accounts ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can only see their own
CREATE POLICY "Users can view own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- One-shot: Users can only see their own
CREATE POLICY "Users can view own oneshot purchases"
  ON public.user_oneshot_purchases FOR SELECT
  USING (auth.uid() = user_id);

-- Enterprise: Users can only see their own
CREATE POLICY "Users can view own enterprise accounts"
  ON public.enterprise_accounts FOR SELECT
  USING (auth.uid() = user_id);

-- 12. Triggers pour updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_oneshot_purchases_updated_at
  BEFORE UPDATE ON public.user_oneshot_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enterprise_accounts_updated_at
  BEFORE UPDATE ON public.enterprise_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================


