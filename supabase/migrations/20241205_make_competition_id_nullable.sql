-- Migration: Rendre competition_id nullable pour supporter les compétitions custom
-- Les tournois peuvent maintenant utiliser soit competition_id (compétitions importées)
-- soit custom_competition_id (compétitions personnalisées comme Best of Week)

-- Supprimer la contrainte NOT NULL sur competition_id (déjà fait)
ALTER TABLE tournaments ALTER COLUMN competition_id DROP NOT NULL;

-- Ajouter une contrainte CHECK pour s'assurer qu'au moins un des deux est défini (si pas déjà existante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_competition_type'
  ) THEN
    ALTER TABLE tournaments ADD CONSTRAINT check_competition_type
      CHECK (competition_id IS NOT NULL OR custom_competition_id IS NOT NULL);
  END IF;
END $$;
