-- =====================================================
-- FIX: Supprimer le trigger de cache pour custom_competition_matches
-- =====================================================
-- Le trigger utilisait les mauvais noms de colonnes (home_team au lieu de home_team_name)
-- On supprime le trigger et on utilise des jointures à la place pour récupérer les infos
-- Cela permet aussi d'avoir toujours les scores finaux à jour
-- =====================================================

-- Supprimer le trigger
DROP TRIGGER IF EXISTS trigger_sync_custom_match_cache ON public.custom_competition_matches;

-- Supprimer la fonction du trigger
DROP FUNCTION IF EXISTS public.sync_custom_match_cache();

-- =====================================================
-- FIN DU FIX
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix: Trigger custom match cache supprimé';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Le trigger qui causait l erreur a été supprimé.';
  RAISE NOTICE 'Les infos des matchs seront récupérées via jointure.';
  RAISE NOTICE '========================================';
END $$;
