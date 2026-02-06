-- =====================================================
-- MIGRATION: Tracking des vues des modales incitatives
-- Date: 2026-02-05
-- =====================================================
-- Permet de tracker quelles modales ont été affichées
-- à quel utilisateur, dans quel tournoi
-- =====================================================

-- 1. Créer la table user_modal_views
CREATE TABLE IF NOT EXISTS public.user_modal_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  modal_type TEXT NOT NULL CHECK (modal_type IN (
    'stats_option',
    'player_extension_2_1',
    'player_extension_0',
    'duration_extension'
  )),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte unique : un user ne peut voir qu'une seule fois chaque type de modale par tournoi
  UNIQUE(user_id, tournament_id, modal_type)
);

-- 2. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_modal_views_user_id ON public.user_modal_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_modal_views_tournament_id ON public.user_modal_views(tournament_id);
CREATE INDEX IF NOT EXISTS idx_user_modal_views_modal_type ON public.user_modal_views(modal_type);
CREATE INDEX IF NOT EXISTS idx_user_modal_views_user_tournament ON public.user_modal_views(user_id, tournament_id);

-- 3. RLS (Row Level Security)
ALTER TABLE public.user_modal_views ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres vues
CREATE POLICY "Users can view their own modal views"
  ON public.user_modal_views
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent insérer leurs propres vues
CREATE POLICY "Users can insert their own modal views"
  ON public.user_modal_views
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Fonction helper pour enregistrer qu'une modale a été vue
CREATE OR REPLACE FUNCTION public.mark_modal_as_viewed(
  p_tournament_id UUID,
  p_modal_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Récupérer l'user ID authentifié
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Insérer ou ignorer si déjà existant
  INSERT INTO public.user_modal_views (user_id, tournament_id, modal_type)
  VALUES (v_user_id, p_tournament_id, p_modal_type)
  ON CONFLICT (user_id, tournament_id, modal_type) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction helper pour vérifier si une modale a déjà été vue
CREATE OR REPLACE FUNCTION public.has_viewed_modal(
  p_tournament_id UUID,
  p_modal_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  -- Récupérer l'user ID authentifié
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Vérifier si existe
  SELECT COUNT(*) INTO v_count
  FROM public.user_modal_views
  WHERE user_id = v_user_id
    AND tournament_id = p_tournament_id
    AND modal_type = p_modal_type;

  RETURN v_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
