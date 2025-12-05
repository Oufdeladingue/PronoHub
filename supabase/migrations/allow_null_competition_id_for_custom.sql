-- =====================================================
-- Migration: Permettre competition_id NULL pour les compétitions custom
-- =====================================================
-- Problème: La colonne competition_id a une contrainte NOT NULL
-- mais pour les compétitions personnalisées (Best of Week),
-- on utilise custom_competition_id à la place
-- =====================================================

-- Supprimer la contrainte NOT NULL sur competition_id
ALTER TABLE public.tournaments
ALTER COLUMN competition_id DROP NOT NULL;

-- Ajouter une contrainte CHECK pour s'assurer qu'au moins un des deux est présent
-- (competition_id OU custom_competition_id)
ALTER TABLE public.tournaments
ADD CONSTRAINT tournaments_competition_check
CHECK (
  competition_id IS NOT NULL
  OR custom_competition_id IS NOT NULL
);

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'competition_id peut maintenant être NULL';
  RAISE NOTICE 'si custom_competition_id est renseigné';
  RAISE NOTICE '========================================';
END $$;
