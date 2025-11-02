-- Ajouter la colonne is_active à la table competitions (si elle n'existe pas déjà)
-- Exécutez ce script si vous avez déjà créé la table competitions sans cette colonne

ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Mettre toutes les compétitions existantes comme actives par défaut
UPDATE public.competitions
SET is_active = true
WHERE is_active IS NULL;
