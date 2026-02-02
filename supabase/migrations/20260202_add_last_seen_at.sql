-- Migration: Ajouter le champ last_seen_at pour tracker la dernière visite
-- Date: 2026-02-02

-- Ajouter la colonne last_seen_at à la table profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NULL;

-- Créer un index pour les requêtes sur last_seen_at (utile pour les requêtes admin)
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at DESC NULLS LAST);

-- Commenter la colonne
COMMENT ON COLUMN profiles.last_seen_at IS 'Date et heure de la dernière visite de l''utilisateur sur l''application';
