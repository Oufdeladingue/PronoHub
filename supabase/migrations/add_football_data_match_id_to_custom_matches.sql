-- =====================================================
-- MIGRATION: Ajouter football_data_match_id aux custom_competition_matches
-- =====================================================
-- Cette migration résout le problème des mises à jour Football-Data
-- qui régénèrent les UUID des matchs importés.
-- On utilise désormais football_data_match_id (stable) pour les jointures.
-- =====================================================

-- 1. Ajouter la colonne football_data_match_id
ALTER TABLE public.custom_competition_matches
ADD COLUMN IF NOT EXISTS football_data_match_id INTEGER;

COMMENT ON COLUMN public.custom_competition_matches.football_data_match_id IS 'ID stable du match depuis Football-Data.org (ne change pas lors des mises à jour)';

-- 2. Migrer les données existantes (si l'UUID existe encore dans imported_matches)
UPDATE public.custom_competition_matches ccm
SET football_data_match_id = im.football_data_match_id
FROM public.imported_matches im
WHERE ccm.imported_match_id = im.id
  AND ccm.football_data_match_id IS NULL;

-- 3. Créer un index pour les jointures sur football_data_match_id
CREATE INDEX IF NOT EXISTS idx_custom_matches_football_data_id
  ON public.custom_competition_matches(football_data_match_id);

-- 4. Modifier la contrainte d'unicité pour utiliser football_data_match_id
-- D'abord supprimer l'ancienne contrainte
ALTER TABLE public.custom_competition_matches
DROP CONSTRAINT IF EXISTS custom_competition_matches_custom_matchday_id_imported_matc_key;

-- Nouvelle contrainte basée sur football_data_match_id
-- (un match ne peut être dans une journée qu'une seule fois, basé sur l'ID stable)
ALTER TABLE public.custom_competition_matches
ADD CONSTRAINT custom_competition_matches_matchday_football_id_unique
UNIQUE(custom_matchday_id, football_data_match_id);

-- 5. Rendre imported_match_id nullable (on ne l'utilise plus comme clé primaire de liaison)
-- Note: On garde la colonne pour la compatibilité, mais elle n'est plus critique
ALTER TABLE public.custom_competition_matches
ALTER COLUMN imported_match_id DROP NOT NULL;

-- 6. Supprimer la foreign key sur imported_match_id (les UUIDs peuvent changer)
ALTER TABLE public.custom_competition_matches
DROP CONSTRAINT IF EXISTS custom_competition_matches_imported_match_id_fkey;

-- ============================================
-- FIN DE LA MIGRATION
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration football_data_match_id terminée';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Modifications:';
  RAISE NOTICE '  - Colonne football_data_match_id ajoutée';
  RAISE NOTICE '  - Index créé sur football_data_match_id';
  RAISE NOTICE '  - Contrainte d''unicité mise à jour';
  RAISE NOTICE '  - imported_match_id maintenant nullable';
  RAISE NOTICE '  - Foreign key supprimée (les UUIDs changent)';
  RAISE NOTICE '========================================';
END $$;
