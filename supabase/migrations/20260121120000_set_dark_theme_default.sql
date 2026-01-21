-- Définir 'dark' comme valeur par défaut pour theme_preference
ALTER TABLE public.profiles
ALTER COLUMN theme_preference SET DEFAULT 'dark';

-- Mettre à jour les profils existants qui n'ont pas de préférence définie
UPDATE public.profiles
SET theme_preference = 'dark'
WHERE theme_preference IS NULL;
