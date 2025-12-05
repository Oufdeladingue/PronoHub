-- =====================================================
-- Migration: Corriger RLS pour custom_competition_matchdays
-- =====================================================
-- Problème: La politique actuelle ne permet de voir que les matchdays
-- avec status 'published' ou 'completed', mais le vestiaire a besoin
-- de compter toutes les journées pour afficher "X journées restantes"
-- =====================================================

-- Supprimer l'ancienne politique de lecture
DROP POLICY IF EXISTS "Public can view published matchdays" ON public.custom_competition_matchdays;

-- Nouvelle politique: Les utilisateurs authentifiés peuvent voir tous les matchdays
-- des compétitions actives pour le comptage
CREATE POLICY "Authenticated users can view matchdays of active competitions"
  ON public.custom_competition_matchdays FOR SELECT
  USING (
    -- Soit le matchday est publié/complété (visible à tous)
    status IN ('published', 'completed', 'active')
    OR
    -- Soit l'utilisateur est authentifié et la compétition est active
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.custom_competitions
        WHERE id = custom_competition_id
        AND is_active = TRUE
      )
    )
  );

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS corrigé pour custom_competition_matchdays';
  RAISE NOTICE 'Les utilisateurs authentifiés peuvent maintenant';
  RAISE NOTICE 'voir les journées des compétitions actives';
  RAISE NOTICE '========================================';
END $$;
