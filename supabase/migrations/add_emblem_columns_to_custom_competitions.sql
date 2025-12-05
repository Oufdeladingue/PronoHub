-- =====================================================
-- Migration: Ajouter les colonnes d'emblèmes aux compétitions custom
-- =====================================================

-- Ajouter les colonnes pour les logos custom
ALTER TABLE public.custom_competitions
ADD COLUMN IF NOT EXISTS custom_emblem_white TEXT,
ADD COLUMN IF NOT EXISTS custom_emblem_color TEXT;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Colonnes custom_emblem_white et custom_emblem_color ajoutées';
  RAISE NOTICE 'à la table custom_competitions';
  RAISE NOTICE '========================================';
END $$;
