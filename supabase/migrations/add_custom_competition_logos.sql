-- Migration pour ajouter les champs de logos personnalisés aux compétitions
-- Date: 2025-11-26

-- Ajouter les colonnes pour les logos personnalisés
ALTER TABLE public.competitions
ADD COLUMN IF NOT EXISTS custom_emblem_white TEXT,
ADD COLUMN IF NOT EXISTS custom_emblem_color TEXT;

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN public.competitions.custom_emblem_white IS 'URL du logo blanc/clair pour affichage sur fond sombre (stocké dans Supabase Storage)';
COMMENT ON COLUMN public.competitions.custom_emblem_color IS 'URL du logo en couleur pour affichage sur fond clair (stocké dans Supabase Storage)';

-- Créer un bucket de stockage pour les logos de compétitions (à exécuter manuellement dans l'interface Supabase)
-- Nom du bucket: competition-logos
-- Public: true
-- Allowed MIME types: image/svg+xml, image/png, image/jpeg, image/webp

-- Policy pour permettre la lecture publique des logos
-- (Les policies d'upload seront gérées par l'admin uniquement via le service role key)
