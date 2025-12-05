-- =====================================================
-- Migration: Corriger RLS pour permettre aux participants de tournois
-- de voir les matchdays et matches des compétitions custom
-- =====================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Authenticated users can view matchdays of active competitions" ON public.custom_competition_matchdays;
DROP POLICY IF EXISTS "Public can view published matchdays" ON public.custom_competition_matchdays;
DROP POLICY IF EXISTS "Public can view matches of published matchdays" ON public.custom_competition_matches;

-- Nouvelle politique pour les matchdays:
-- Les utilisateurs participant à un tournoi basé sur cette compétition custom peuvent voir les matchdays
CREATE POLICY "Tournament participants can view matchdays"
  ON public.custom_competition_matchdays FOR SELECT
  USING (
    -- Matchdays publiés/complétés sont visibles par tous les authentifiés
    (auth.uid() IS NOT NULL AND status IN ('published', 'completed', 'active'))
    OR
    -- OU l'utilisateur participe à un tournoi utilisant cette compétition custom
    EXISTS (
      SELECT 1 FROM public.tournaments t
      JOIN public.tournament_participants tp ON tp.tournament_id = t.id
      WHERE t.custom_competition_id = custom_competition_matchdays.custom_competition_id
      AND tp.user_id = auth.uid()
    )
    OR
    -- OU l'utilisateur est le créateur d'un tournoi utilisant cette compétition
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.custom_competition_id = custom_competition_matchdays.custom_competition_id
      AND t.creator_id = auth.uid()
    )
  );

-- Nouvelle politique pour les matches:
-- Les utilisateurs participant à un tournoi peuvent voir les matches des matchdays associés
CREATE POLICY "Tournament participants can view custom matches"
  ON public.custom_competition_matches FOR SELECT
  USING (
    -- Matches des matchdays publiés/complétés
    EXISTS (
      SELECT 1 FROM public.custom_competition_matchdays md
      WHERE md.id = custom_competition_matches.custom_matchday_id
      AND md.status IN ('published', 'completed', 'active')
      AND auth.uid() IS NOT NULL
    )
    OR
    -- OU l'utilisateur participe à un tournoi utilisant cette compétition
    EXISTS (
      SELECT 1 FROM public.custom_competition_matchdays md
      JOIN public.tournaments t ON t.custom_competition_id = md.custom_competition_id
      JOIN public.tournament_participants tp ON tp.tournament_id = t.id
      WHERE md.id = custom_competition_matches.custom_matchday_id
      AND tp.user_id = auth.uid()
    )
    OR
    -- OU l'utilisateur est le créateur d'un tournoi
    EXISTS (
      SELECT 1 FROM public.custom_competition_matchdays md
      JOIN public.tournaments t ON t.custom_competition_id = md.custom_competition_id
      WHERE md.id = custom_competition_matches.custom_matchday_id
      AND t.creator_id = auth.uid()
    )
  );

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS corrigé pour custom_competition_matchdays et matches';
  RAISE NOTICE 'Les participants de tournois peuvent maintenant voir';
  RAISE NOTICE 'les matchdays et matches de leur compétition';
  RAISE NOTICE '========================================';
END $$;
