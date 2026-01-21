-- =====================================================
-- MIGRATION: Mettre à jour la saison Best of Week
-- =====================================================
-- La compétition Best of Week était marquée comme saison 2024-2025
-- Ce qui la fait apparaître comme "Saison terminée"
-- On la met à jour vers 2025-2026
-- =====================================================

-- Mettre à jour la saison de la compétition Best of Week
UPDATE public.custom_competitions
SET
  season = '2025-2026',
  updated_at = NOW()
WHERE code = 'BOTW';

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Mise à jour Best of Week';
  RAISE NOTICE '  - Saison: 2024-2025 -> 2025-2026';
  RAISE NOTICE '========================================';
END $$;
