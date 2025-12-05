-- =====================================================
-- MIGRATION: Tournois Événement + Compétitions Custom (Best of Week)
-- =====================================================
-- Cette migration ajoute :
-- 1. Flag is_event sur les compétitions (Coupe du Monde, Euro, etc.)
-- 2. Tables pour les compétitions custom (Best of Week)
-- 3. Quota séparé pour les tournois événement
-- =====================================================

-- ============================================
-- 1. FLAG IS_EVENT SUR COMPETITIONS
-- ============================================

-- Ajouter le flag is_event à la table competitions
ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.competitions.is_event IS 'Compétition événementielle (Coupe du Monde, Euro, etc.) - quota séparé pour les users';

-- Index pour filtrer les compétitions événementielles
CREATE INDEX IF NOT EXISTS idx_competitions_is_event
  ON public.competitions(is_event) WHERE is_event = TRUE;

-- Marquer les compétitions événementielles connues
UPDATE public.competitions
SET is_event = TRUE
WHERE id IN (
  2018,  -- World Cup (football-data.org)
  2000   -- European Championship (football-data.org)
);

-- ============================================
-- 2. TABLE: custom_competitions (Best of Week, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS public.custom_competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Informations de base
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,  -- ex: 'BOTW' pour Best of Week
  description TEXT,
  emblem_url TEXT,

  -- Type de compétition custom
  competition_type TEXT NOT NULL DEFAULT 'best_of_week'
    CHECK (competition_type IN ('best_of_week', 'custom')),

  -- Configuration
  matches_per_matchday INTEGER DEFAULT 8,  -- Nombre de matchs par journée (8-10)
  is_active BOOLEAN DEFAULT TRUE,

  -- Saison
  season TEXT,  -- ex: '2024-2025'
  start_date DATE,
  end_date DATE,

  -- Compteurs
  current_matchday INTEGER DEFAULT 0,
  total_matchdays INTEGER DEFAULT 0,

  -- Métadonnées
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.custom_competitions IS 'Compétitions personnalisées créées par les admins (Best of Week, etc.)';
COMMENT ON COLUMN public.custom_competitions.code IS 'Code unique de la compétition (ex: BOTW)';
COMMENT ON COLUMN public.custom_competitions.matches_per_matchday IS 'Nombre de matchs à sélectionner par journée';

-- Index
CREATE INDEX IF NOT EXISTS idx_custom_competitions_active
  ON public.custom_competitions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_custom_competitions_type
  ON public.custom_competitions(competition_type);

-- ============================================
-- 3. TABLE: custom_competition_matchdays (Journées)
-- ============================================

CREATE TABLE IF NOT EXISTS public.custom_competition_matchdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien avec la compétition custom
  custom_competition_id UUID NOT NULL REFERENCES public.custom_competitions(id) ON DELETE CASCADE,

  -- Numéro de journée
  matchday_number INTEGER NOT NULL,

  -- Plage de dates de la semaine
  week_start DATE NOT NULL,  -- Lundi de la semaine
  week_end DATE NOT NULL,    -- Dimanche de la semaine

  -- Statut
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'completed')),

  -- Métadonnées
  created_by UUID REFERENCES public.profiles(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: une seule journée par numéro par compétition
  UNIQUE(custom_competition_id, matchday_number)
);

COMMENT ON TABLE public.custom_competition_matchdays IS 'Journées des compétitions custom avec leur plage de dates';

-- Index
CREATE INDEX IF NOT EXISTS idx_custom_matchdays_competition
  ON public.custom_competition_matchdays(custom_competition_id);
CREATE INDEX IF NOT EXISTS idx_custom_matchdays_status
  ON public.custom_competition_matchdays(status);

-- ============================================
-- 4. TABLE: custom_competition_matches (Matchs sélectionnés)
-- ============================================

CREATE TABLE IF NOT EXISTS public.custom_competition_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien avec la journée custom
  custom_matchday_id UUID NOT NULL REFERENCES public.custom_competition_matchdays(id) ON DELETE CASCADE,

  -- Lien avec le match original importé
  imported_match_id UUID NOT NULL REFERENCES public.imported_matches(id) ON DELETE CASCADE,

  -- Ordre d'affichage dans la journée
  display_order INTEGER DEFAULT 0,

  -- Cache des infos du match (pour éviter les joins)
  cached_home_team TEXT,
  cached_away_team TEXT,
  cached_home_logo TEXT,
  cached_away_logo TEXT,
  cached_utc_date TIMESTAMPTZ,
  cached_competition_name TEXT,

  -- Métadonnées
  added_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: un match ne peut être dans une journée qu'une seule fois
  UNIQUE(custom_matchday_id, imported_match_id)
);

COMMENT ON TABLE public.custom_competition_matches IS 'Matchs sélectionnés pour chaque journée des compétitions custom';

-- Index
CREATE INDEX IF NOT EXISTS idx_custom_matches_matchday
  ON public.custom_competition_matches(custom_matchday_id);
CREATE INDEX IF NOT EXISTS idx_custom_matches_imported
  ON public.custom_competition_matches(imported_match_id);

-- ============================================
-- 5. FONCTION: Synchroniser le cache des matchs custom
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_custom_match_cache()
RETURNS TRIGGER AS $$
BEGIN
  -- Mettre à jour le cache avec les infos du match importé
  SELECT
    im.home_team,
    im.away_team,
    im.home_team_crest,
    im.away_team_crest,
    im.utc_date,
    c.name
  INTO
    NEW.cached_home_team,
    NEW.cached_away_team,
    NEW.cached_home_logo,
    NEW.cached_away_logo,
    NEW.cached_utc_date,
    NEW.cached_competition_name
  FROM public.imported_matches im
  JOIN public.competitions c ON c.id = im.competition_id
  WHERE im.id = NEW.imported_match_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour sync automatique du cache
CREATE TRIGGER trigger_sync_custom_match_cache
  BEFORE INSERT OR UPDATE OF imported_match_id ON public.custom_competition_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_custom_match_cache();

-- ============================================
-- 6. MODIFICATION: Ajouter tournament_type 'event'
-- ============================================

-- Modifier la contrainte sur tournament_type pour inclure 'event'
ALTER TABLE public.tournaments
DROP CONSTRAINT IF EXISTS tournaments_tournament_type_check;

ALTER TABLE public.tournaments
ADD CONSTRAINT tournaments_tournament_type_check
CHECK (tournament_type IN ('free', 'oneshot', 'elite', 'platinium', 'enterprise', 'event'));

-- ============================================
-- 7. MODIFICATION: Lier tournaments aux compétitions custom
-- ============================================

-- Ajouter une colonne pour lier un tournoi à une compétition custom
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS custom_competition_id UUID REFERENCES public.custom_competitions(id);

COMMENT ON COLUMN public.tournaments.custom_competition_id IS 'ID de la compétition custom (Best of Week) si applicable';

-- Index
CREATE INDEX IF NOT EXISTS idx_tournaments_custom_competition
  ON public.tournaments(custom_competition_id) WHERE custom_competition_id IS NOT NULL;

-- ============================================
-- 8. VUE: Mise à jour user_quotas pour inclure les événements
-- ============================================

-- Supprimer l'ancienne vue
DROP VIEW IF EXISTS public.user_quotas;

-- Recréer avec les quotas événements
CREATE OR REPLACE VIEW public.user_quotas AS
SELECT
  p.id as user_id,
  p.username,

  -- Statut abonnement
  COALESCE(us.status, 'none') as subscription_status,
  us.subscription_type,
  us.current_period_end as subscription_expires_at,

  -- Compteur tournois gratuits actifs (max 2)
  (
    SELECT COUNT(*)
    FROM public.tournaments t
    WHERE t.creator_id = p.id
    AND t.tournament_type = 'free'
    AND t.status != 'completed'
  )::INTEGER as free_tournaments_active,
  2 as free_tournaments_max,

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

  -- NOUVEAU: Compteur tournois événement gratuits actifs (max 1)
  (
    SELECT COUNT(*)
    FROM public.tournaments t
    JOIN public.competitions c ON c.id = t.competition_id
    WHERE (t.creator_id = p.id OR EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = t.id AND tp.user_id = p.id
    ))
    AND c.is_event = TRUE
    AND t.status != 'completed'
    AND t.tournament_type = 'event'
  )::INTEGER as event_tournaments_active,
  1 as event_tournaments_max,

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
    ) < 2 THEN TRUE
    ELSE FALSE
  END as can_create_tournament

FROM public.profiles p
LEFT JOIN public.user_subscriptions us ON us.user_id = p.id AND us.status = 'active';

-- ============================================
-- 9. TABLE: event_tournament_slots (Slots achetés pour événements)
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_tournament_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Lien avec le tournoi (NULL tant que non utilisé)
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,

  -- Statut du slot
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'expired')),

  -- Informations Stripe
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_checkout_session_id TEXT,
  amount_paid INTEGER DEFAULT 99, -- 0.99€ en centimes
  currency TEXT DEFAULT 'eur',

  -- Dates
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.event_tournament_slots IS 'Slots achetés pour participer/créer des tournois sur compétitions événementielles';

-- Index
CREATE INDEX IF NOT EXISTS idx_event_slots_user ON public.event_tournament_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_event_slots_status ON public.event_tournament_slots(status);
CREATE INDEX IF NOT EXISTS idx_event_slots_tournament ON public.event_tournament_slots(tournament_id);

-- RLS
ALTER TABLE public.event_tournament_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own event slots"
  ON public.event_tournament_slots FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_event_tournament_slots_updated_at
  BEFORE UPDATE ON public.event_tournament_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. RLS pour les tables custom_competitions
-- ============================================

ALTER TABLE public.custom_competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_competition_matchdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_competition_matches ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les compétitions custom actives
CREATE POLICY "Public can view active custom competitions"
  ON public.custom_competitions FOR SELECT
  USING (is_active = TRUE);

-- Admins peuvent tout faire
CREATE POLICY "Admins can manage custom competitions"
  ON public.custom_competitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Lecture publique pour les journées publiées
CREATE POLICY "Public can view published matchdays"
  ON public.custom_competition_matchdays FOR SELECT
  USING (status IN ('published', 'completed'));

-- Admins peuvent tout faire sur les journées
CREATE POLICY "Admins can manage custom matchdays"
  ON public.custom_competition_matchdays FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Lecture publique pour les matchs des journées publiées
CREATE POLICY "Public can view matches of published matchdays"
  ON public.custom_competition_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_competition_matchdays
      WHERE id = custom_matchday_id
      AND status IN ('published', 'completed')
    )
  );

-- Admins peuvent tout faire sur les matchs
CREATE POLICY "Admins can manage custom matches"
  ON public.custom_competition_matches FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 11. FONCTION: Vérifier si user peut rejoindre tournoi événement
-- ============================================

CREATE OR REPLACE FUNCTION public.can_join_event_tournament(
  p_user_id UUID,
  p_tournament_id UUID
) RETURNS TABLE(
  can_join BOOLEAN,
  reason TEXT,
  needs_payment BOOLEAN
) AS $$
DECLARE
  v_event_active INTEGER;
  v_has_free_slot BOOLEAN;
  v_has_purchased_slot BOOLEAN;
BEGIN
  -- Compter les participations événement actives
  SELECT COUNT(*) INTO v_event_active
  FROM public.tournaments t
  JOIN public.competitions c ON c.id = t.competition_id
  WHERE c.is_event = TRUE
  AND t.status != 'completed'
  AND (
    t.creator_id = p_user_id
    OR EXISTS (
      SELECT 1 FROM public.tournament_participants tp
      WHERE tp.tournament_id = t.id AND tp.user_id = p_user_id
    )
  );

  -- Vérifier si a un slot gratuit (aucune participation événement active)
  v_has_free_slot := (v_event_active < 1);

  -- Vérifier si a un slot acheté disponible
  SELECT EXISTS(
    SELECT 1 FROM public.event_tournament_slots
    WHERE user_id = p_user_id
    AND status = 'available'
  ) INTO v_has_purchased_slot;

  -- Déterminer le résultat
  IF v_has_free_slot THEN
    RETURN QUERY SELECT TRUE, 'Slot gratuit disponible', FALSE;
  ELSIF v_has_purchased_slot THEN
    RETURN QUERY SELECT TRUE, 'Slot acheté disponible', FALSE;
  ELSE
    RETURN QUERY SELECT FALSE, 'Quota événement atteint - achat requis', TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.can_join_event_tournament IS 'Vérifie si un utilisateur peut rejoindre un tournoi événement (1 gratuit, puis payant)';

-- ============================================
-- 12. Insérer la compétition Best of Week par défaut
-- ============================================

INSERT INTO public.custom_competitions (
  name,
  code,
  description,
  competition_type,
  matches_per_matchday,
  season,
  is_active
) VALUES (
  'Best of Week',
  'BOTW',
  'Les plus belles affiches de la semaine - Sélection des meilleurs matchs de toutes les compétitions',
  'best_of_week',
  8,
  '2024-2025',
  TRUE
) ON CONFLICT (code) DO NOTHING;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Événements + Custom Competitions';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Modifications:';
  RAISE NOTICE '  - Ajout is_event sur competitions';
  RAISE NOTICE '  - Table custom_competitions créée';
  RAISE NOTICE '  - Table custom_competition_matchdays créée';
  RAISE NOTICE '  - Table custom_competition_matches créée';
  RAISE NOTICE '  - Table event_tournament_slots créée';
  RAISE NOTICE '  - Vue user_quotas mise à jour';
  RAISE NOTICE '  - Fonction can_join_event_tournament créée';
  RAISE NOTICE '  - Compétition Best of Week initialisée';
  RAISE NOTICE '========================================';
END $$;
